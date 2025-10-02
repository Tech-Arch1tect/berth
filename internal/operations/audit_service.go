package operations

import (
	"berth/models"
	"encoding/json"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AuditService struct {
	db     *gorm.DB
	logger *logging.Service
}

func NewAuditService(db *gorm.DB, logger *logging.Service) *AuditService {
	return &AuditService{
		db:     db,
		logger: logger,
	}
}

func (s *AuditService) LogOperationStart(userID uint, serverID uint, stackName string, operationID string, request OperationRequest, startTime time.Time) (*models.OperationLog, error) {
	s.logger.Debug("logging operation start",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("operation_id", operationID),
		zap.String("command", request.Command),
		zap.Time("start_time", startTime),
	)

	options, err := json.Marshal(request.Options)
	if err != nil {
		s.logger.Error("failed to marshal operation options",
			zap.Error(err),
			zap.String("operation_id", operationID),
		)
	}

	services, err := json.Marshal(request.Services)
	if err != nil {
		s.logger.Error("failed to marshal operation services",
			zap.Error(err),
			zap.String("operation_id", operationID),
		)
	}

	log := &models.OperationLog{
		UserID:      userID,
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
	s.logger.Debug("logging operation message",
		zap.Uint("operation_log_id", operationLogID),
		zap.String("message_type", messageType),
		zap.Int("sequence_number", sequenceNumber),
		zap.Time("timestamp", timestamp),
		zap.Int("message_length", len(messageData)),
	)

	message := &models.OperationLogMessage{
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
	if err := s.db.Model(&models.OperationLog{}).Where("id = ?", operationLogID).Update("last_message_at", now).Error; err != nil {
		s.logger.Error("failed to update last_message_at",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
		)
	}

	return nil
}

func (s *AuditService) LogOperationEnd(operationLogID uint, endTime time.Time, success bool, exitCode int) error {
	s.logger.Debug("logging operation end",
		zap.Uint("operation_log_id", operationLogID),
		zap.Time("end_time", endTime),
		zap.Bool("success", success),
		zap.Int("exit_code", exitCode),
	)

	log := &models.OperationLog{}
	if err := s.db.First(log, operationLogID).Error; err != nil {
		s.logger.Error("failed to find operation log",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
		)
		return err
	}

	var duration int

	if endTime.IsZero() || endTime.Before(log.StartTime) {
		s.logger.Warn("invalid end time for operation",
			zap.Uint("operation_log_id", operationLogID),
			zap.Time("end_time", endTime),
			zap.Time("start_time", log.StartTime),
			zap.Bool("end_time_is_zero", endTime.IsZero()),
		)

		duration = 0
	} else {
		duration = int(endTime.Sub(log.StartTime).Milliseconds())
	}

	s.logger.Debug("calculated operation duration",
		zap.Uint("operation_log_id", operationLogID),
		zap.Int("duration_ms", duration),
		zap.Time("start_time", log.StartTime),
		zap.Time("end_time", endTime),
		zap.Bool("valid_end_time", !endTime.IsZero() && !endTime.Before(log.StartTime)),
	)

	updates := map[string]any{
		"success":   success,
		"exit_code": exitCode,
	}

	if !endTime.IsZero() && !endTime.Before(log.StartTime) {
		updates["end_time"] = endTime
		updates["duration"] = duration
	} else {

		updates["duration"] = nil
		s.logger.Warn("skipping end_time update due to invalid time",
			zap.Uint("operation_log_id", operationLogID),
			zap.Time("invalid_end_time", endTime),
		)
	}

	if err := s.db.Model(log).Updates(updates).Error; err != nil {
		s.logger.Error("failed to save operation end log",
			zap.Error(err),
			zap.Uint("operation_log_id", operationLogID),
			zap.Bool("success", success),
			zap.Int("exit_code", exitCode),
		)
		return err
	}

	s.logger.Info("operation end logged successfully",
		zap.Uint("operation_log_id", operationLogID),
		zap.String("operation_id", log.OperationID),
		zap.String("command", log.Command),
		zap.Bool("success", success),
		zap.Int("exit_code", exitCode),
		zap.Int("duration_ms", duration),
	)

	return nil
}
