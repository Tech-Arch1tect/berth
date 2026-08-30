package operations

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"berth/internal/domain/operationlogs"
	"berth/internal/domain/security"
	"berth/internal/domain/user"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type transactionSecurityAuditor interface {
	LogWithDB(db *gorm.DB, event security.LogEvent) error
}

type backupAuditContext struct {
	Command        string
	OperationID    string
	ActorUserID    uint
	ActorUsername  string
	ActorIP        string
	ActorUserAgent string
	ServerID       uint
	StackName      string
	BackupID       string
	Metadata       map[string]any
}

type operationCompletion struct {
	Timestamp time.Time
	Success   bool
	ExitCode  int
}

type AuditService struct {
	db              *gorm.DB
	logger          *zap.Logger
	summaryParser   *SummaryParser
	securityAuditor transactionSecurityAuditor
	persistenceMu   sync.Mutex
}

func NewAuditService(db *gorm.DB, logger *zap.Logger, summaryParser *SummaryParser) *AuditService {
	return &AuditService{
		db:            db,
		logger:        logger,
		summaryParser: summaryParser,
	}
}

func (s *AuditService) SetSecurityAuditor(auditor transactionSecurityAuditor) {
	s.securityAuditor = auditor
}

const maxOperationLogBackupLabelLength = 100

var operationLogBackupLabelRegex = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 .,_+()/:'-]*$`)

type operationLogRequestFields struct {
	Options  []string
	Services []string
}

func operationLogFields(request OperationRequest) operationLogRequestFields {
	switch request.Command {
	case "create-backup":
		if options, valid := parseCreateBackupLogOptions(request.Options, request.Services); valid {
			return operationLogRequestFields{Options: options, Services: []string{}}
		}
		return operationLogRequestFields{Options: []string{}, Services: []string{}}
	case "restore-backup":
		if options, valid := parseRestoreBackupLogOptions(request.Options, request.Services); valid {
			return operationLogRequestFields{Options: options, Services: []string{}}
		}
		return operationLogRequestFields{Options: []string{}, Services: []string{}}
	default:
		return operationLogRequestFields{
			Options:  append([]string(nil), request.Options...),
			Services: append([]string(nil), request.Services...),
		}
	}
}

func parseCreateBackupLogOptions(options, services []string) ([]string, bool) {
	if len(services) != 0 {
		return nil, false
	}
	stop := false
	pause := false
	for i := 0; i < len(options); i++ {
		switch options[i] {
		case "--stop":
			stop = true
		case "--pause":
			pause = true
		case "--label":
			if i+1 >= len(options) || strings.HasPrefix(options[i+1], "--") {
				return nil, false
			}
			i++
			label := strings.TrimSpace(options[i])
			if label == "" || len(label) > maxOperationLogBackupLabelLength || !operationLogBackupLabelRegex.MatchString(label) {
				return nil, false
			}
		default:
			return nil, false
		}
	}
	if stop && pause {
		return nil, false
	}
	return append([]string(nil), options...), true
}

func parseRestoreBackupLogOptions(options, services []string) ([]string, bool) {
	if len(services) != 0 {
		return nil, false
	}
	backupID := ""
	for i := 0; i < len(options); i++ {
		switch options[i] {
		case "--backup-id":
			if i+1 >= len(options) || strings.HasPrefix(options[i+1], "--") {
				return nil, false
			}
			i++
			if _, err := uuid.Parse(options[i]); err != nil {
				return nil, false
			}
			backupID = options[i]
		case "--component":
			if i+1 >= len(options) || strings.HasPrefix(options[i+1], "--") {
				return nil, false
			}
			i++
			if options[i] == "" || operationLogComponentHasDangerousCharacters(options[i]) {
				return nil, false
			}
		case "--stop", "--keep-extra-files", "--sparse":
		default:
			return nil, false
		}
	}
	if backupID == "" {
		return nil, false
	}
	return append([]string(nil), options...), true
}

func operationLogComponentHasDangerousCharacters(value string) bool {
	for _, pattern := range []string{";", "&", "|", "$", "`", ")", "{", "}", "<", ">", "\\", "'", "\"", "\n", "\r", "\t"} {
		if strings.Contains(value, pattern) {
			return true
		}
	}
	return false
}

func (s *AuditService) LogOperationStart(userID uint, serverID uint, stackName string, operationID string, request OperationRequest, startTime time.Time) (*operationlogs.OperationLog, error) {
	s.logger.Debug("logging operation start",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("operation_id", operationID),
		zap.String("command", request.Command),
		zap.Time("start_time", startTime),
	)

	fields := operationLogFields(request)
	options, err := json.Marshal(fields.Options)
	if err != nil {
		s.logger.Error("failed to marshal operation options",
			zap.Error(err),
			zap.String("operation_id", operationID),
		)
	}

	services, err := json.Marshal(fields.Services)
	if err != nil {
		s.logger.Error("failed to marshal operation services",
			zap.Error(err),
			zap.String("operation_id", operationID),
		)
	}

	var username string
	if err := s.db.Model(&user.User{}).Select("username").Where("id = ?", userID).Scan(&username).Error; err != nil {
		s.logger.Warn("failed to resolve username for operation log",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("operation_id", operationID),
		)
	}

	log := &operationlogs.OperationLog{
		UserID:      userID,
		UserName:    username,
		ServerID:    serverID,
		StackName:   stackName,
		OperationID: operationID,
		Command:     request.Command,
		Options:     string(options),
		Services:    string(services),
		StartTime:   startTime,
	}

	if err := s.db.Create(log).Error; err != nil {
		s.logger.Error("failed to save operation start log",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("operation_id", operationID),
			zap.String("command", request.Command),
		)
		return nil, err
	}

	s.logger.Info("operation start logged successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("operation_id", operationID),
		zap.String("command", request.Command),
		zap.Uint("log_id", log.ID),
	)

	return log, nil
}

func (s *AuditService) LogOperationMessage(operationLogID uint, messageType string, messageData string, timestamp time.Time, sequenceNumber int) error {
	s.persistenceMu.Lock()
	defer s.persistenceMu.Unlock()

	s.logger.Debug("logging operation message",
		zap.Uint("operation_log_id", operationLogID),
		zap.String("message_type", messageType),
		zap.Int("sequence_number", sequenceNumber),
		zap.Time("timestamp", timestamp),
		zap.Int("message_length", len(messageData)),
	)

	message := &operationlogs.OperationLogMessage{
		OperationLogID: operationLogID,
		MessageType:    messageType,
		MessageData:    messageData,
		Timestamp:      timestamp,
		SequenceNumber: sequenceNumber,
	}

	if err := s.db.Create(message).Error; err != nil {
		s.logger.Error("failed to save operation message",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
			zap.String("message_type", messageType),
			zap.Int("sequence_number", sequenceNumber),
		)
		return err
	}

	now := time.Now()
	if err := s.db.Model(&operationlogs.OperationLog{}).Where("id = ?", operationLogID).Update("last_message_at", now).Error; err != nil {
		s.logger.Error("failed to update last_message_at",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
		)
	}

	return nil
}

func (s *AuditService) FindOperationLogByOperationID(operationID string) (*operationlogs.OperationLog, error) {
	var log operationlogs.OperationLog
	err := s.db.Where("operation_id = ?", operationID).First(&log).Error
	if err != nil {
		s.logger.Debug("operation log not found",
			zap.String("operation_id", operationID),
			zap.Error(err),
		)
		return nil, err
	}
	return &log, nil
}

func (s *AuditService) GetOperationMessagesSince(operationLogID uint, afterSequence int) ([]operationlogs.OperationLogMessage, error) {
	var messages []operationlogs.OperationLogMessage
	err := s.db.
		Where("operation_log_id = ? AND sequence_number > ?", operationLogID, afterSequence).
		Order("sequence_number ASC").
		Find(&messages).Error
	if err != nil {
		s.logger.Error("failed to load operation messages",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
		)
		return nil, err
	}
	return messages, nil
}

func (s *AuditService) LogBackupRequested(ctx *backupAuditContext) error {
	if ctx == nil || s.securityAuditor == nil {
		return nil
	}
	if !isBackupCommand(ctx.Command) {
		return errors.New("unsupported backup operation command")
	}
	return s.securityAuditor.LogWithDB(s.db, backupSecurityEvent(ctx, "requested", true, 0, time.Time{}))
}

func (s *AuditService) LogOperationEnd(operationLogID uint, endTime time.Time, success bool, exitCode int) error {
	return s.CompleteOperation(operationLogID, nil, operationCompletion{
		Timestamp: endTime,
		Success:   success,
		ExitCode:  exitCode,
	})
}

func (s *AuditService) CompleteOperation(operationLogID uint, backupCtx *backupAuditContext, completion operationCompletion) error {
	if backupCtx != nil && !isBackupCommand(backupCtx.Command) {
		return errors.New("unsupported backup operation command")
	}

	s.persistenceMu.Lock()
	defer s.persistenceMu.Unlock()

	s.logger.Debug("logging operation end",
		zap.Uint("operation_log_id", operationLogID),
		zap.Time("end_time", completion.Timestamp),
		zap.Bool("success", completion.Success),
		zap.Int("exit_code", completion.ExitCode),
	)

	return s.db.Transaction(func(tx *gorm.DB) error {
		log := &operationlogs.OperationLog{}
		if err := tx.First(log, operationLogID).Error; err != nil {
			return err
		}
		if log.EndTime != nil {
			return nil
		}

		effectiveEnd := completion.Timestamp
		if effectiveEnd.IsZero() || effectiveEnd.Before(log.StartTime) {
			effectiveEnd = log.StartTime
		}
		duration := int(effectiveEnd.Sub(log.StartTime).Milliseconds())

		updates := map[string]any{
			"success":   completion.Success,
			"exit_code": completion.ExitCode,
			"end_time":  effectiveEnd,
			"duration":  duration,
		}

		var messages []operationlogs.OperationLogMessage
		if err := tx.Where("operation_log_id = ?", operationLogID).
			Order("sequence_number ASC").
			Find(&messages).Error; err != nil {
			return err
		}
		updates["summary"] = s.summaryParser.GenerateSummary(log.Command, completion.Success, completion.ExitCode, messages)

		result := tx.Model(&operationlogs.OperationLog{}).
			Where("id = ? AND end_time IS NULL", operationLogID).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}

		if backupCtx != nil && s.securityAuditor != nil {
			phase := "completed"
			if !completion.Success {
				phase = "failed"
			}
			if err := s.securityAuditor.LogWithDB(tx, backupSecurityEvent(backupCtx, phase, completion.Success, completion.ExitCode, effectiveEnd)); err != nil {
				return err
			}
		}

		s.logger.Info("operation end logged successfully",
			zap.Uint("operation_log_id", operationLogID),
			zap.String("operation_id", log.OperationID),
			zap.String("command", log.Command),
			zap.Bool("success", completion.Success),
			zap.Int("exit_code", completion.ExitCode),
			zap.Int("duration_ms", duration),
		)
		return nil
	})
}

func isBackupCommand(command string) bool {
	return command == "create-backup" || command == "restore-backup"
}

func backupSecurityEvent(ctx *backupAuditContext, phase string, success bool, exitCode int, completedAt time.Time) security.LogEvent {
	metadata := make(map[string]any, len(ctx.Metadata)+8)
	for key, value := range ctx.Metadata {
		if values, ok := value.([]string); ok {
			metadata[key] = append([]string(nil), values...)
		} else {
			metadata[key] = value
		}
	}
	metadata["operation_id"] = ctx.OperationID
	metadata["phase"] = phase
	metadata["command"] = ctx.Command
	metadata["server_id"] = ctx.ServerID
	metadata["stack"] = ctx.StackName

	eventType := security.EventBackupCreateRequested
	if ctx.Command == "restore-backup" {
		eventType = security.EventBackupRestoreRequested
	}
	failureReason := ""
	if phase == "completed" {
		if ctx.Command == "create-backup" {
			eventType = security.EventBackupCreated
		} else {
			eventType = security.EventBackupRestored
		}
		metadata["exit_code"] = exitCode
		metadata["completion_timestamp"] = completedAt.UTC().Format(time.RFC3339Nano)
	}
	if phase == "failed" {
		if ctx.Command == "create-backup" {
			eventType = security.EventBackupCreateFailed
		} else {
			eventType = security.EventBackupRestoreFailed
		}
		failureReason = "operation reported failure"
		metadata["failure_reason_code"] = "operation_reported_failure"
		metadata["exit_code"] = exitCode
		metadata["completion_timestamp"] = completedAt.UTC().Format(time.RFC3339Nano)
	}

	actorUserID := ctx.ActorUserID
	serverID := ctx.ServerID
	return security.LogEvent{
		EventType:      eventType,
		Success:        success,
		ActorUserID:    &actorUserID,
		ActorUsername:  ctx.ActorUsername,
		ActorIP:        ctx.ActorIP,
		ActorUserAgent: ctx.ActorUserAgent,
		TargetType:     security.TargetTypeBackup,
		TargetName:     ctx.BackupID,
		ServerID:       &serverID,
		StackName:      ctx.StackName,
		FailureReason:  failureReason,
		Metadata:       metadata,
	}
}
