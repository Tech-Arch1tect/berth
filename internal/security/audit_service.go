package security

import (
	"encoding/json"
	"time"

	"berth/models"

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

type LogEvent struct {
	EventType string
	Success   bool

	ActorUserID    *uint
	ActorUsername  string
	ActorIP        string
	ActorUserAgent string

	TargetUserID *uint
	TargetType   string
	TargetID     *uint
	TargetName   string

	ServerID  *uint
	StackName string
	SessionID string

	FailureReason string
	Metadata      map[string]any
}

func (s *AuditService) Log(event LogEvent) error {

	var metadataJSON string
	if len(event.Metadata) > 0 {
		bytes, err := json.Marshal(event.Metadata)
		if err != nil {
			s.logger.Error("failed to marshal audit log metadata",
				zap.String("event_type", event.EventType),
				zap.Error(err),
			)

			metadataJSON = "{}"
		} else {
			metadataJSON = string(bytes)
		}
	}

	category := GetEventCategory(event.EventType)
	severity := GetEventSeverity(event.EventType)

	auditLog := models.SecurityAuditLog{
		EventType:     event.EventType,
		EventCategory: category,
		Severity:      severity,

		ActorUserID:    event.ActorUserID,
		ActorUsername:  event.ActorUsername,
		ActorIP:        event.ActorIP,
		ActorUserAgent: event.ActorUserAgent,

		TargetUserID: event.TargetUserID,
		TargetType:   event.TargetType,
		TargetID:     event.TargetID,
		TargetName:   event.TargetName,

		Success:       event.Success,
		FailureReason: event.FailureReason,
		Metadata:      metadataJSON,

		ServerID:  event.ServerID,
		StackName: event.StackName,
		SessionID: event.SessionID,
	}

	if err := s.db.Create(&auditLog).Error; err != nil {
		s.logger.Error("failed to create security audit log",
			zap.String("event_type", event.EventType),
			zap.Error(err),
		)
		return err
	}

	s.logger.Debug("security audit log created",
		zap.String("event_type", event.EventType),
		zap.String("category", category),
		zap.String("severity", severity),
		zap.Bool("success", event.Success),
	)

	return nil
}

func (s *AuditService) LogAuthEvent(eventType string, userID *uint, username string, ip string, userAgent string, success bool, failureReason string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:      eventType,
		Success:        success,
		ActorUserID:    userID,
		ActorUsername:  username,
		ActorIP:        ip,
		ActorUserAgent: userAgent,
		FailureReason:  failureReason,
		Metadata:       metadata,
	})
}

func (s *AuditService) LogUserManagementEvent(eventType string, actorUserID uint, actorUsername string, targetUserID uint, targetUsername string, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetUserID:  &targetUserID,
		TargetType:    models.TargetTypeUser,
		TargetID:      &targetUserID,
		TargetName:    targetUsername,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogRBACEvent(eventType string, actorUserID uint, actorUsername string, targetType string, targetID uint, targetName string, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    targetType,
		TargetID:      &targetID,
		TargetName:    targetName,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogServerEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, serverName string, ip string, success bool, failureReason string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       success,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    models.TargetTypeServer,
		TargetID:      &serverID,
		TargetName:    serverName,
		ServerID:      &serverID,
		FailureReason: failureReason,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogAPIEvent(eventType string, userID *uint, username string, ip string, userAgent string, success bool, failureReason string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:      eventType,
		Success:        success,
		ActorUserID:    userID,
		ActorUsername:  username,
		ActorIP:        ip,
		ActorUserAgent: userAgent,
		FailureReason:  failureReason,
		Metadata:       metadata,
	})
}

func (s *AuditService) LogFileEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName string, filePath string, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    models.TargetTypeFile,
		TargetName:    filePath,
		ServerID:      &serverID,
		StackName:     stackName,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogAPIKeyEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID uint, apiKeyName string, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    models.TargetTypeAPIKey,
		TargetID:      &apiKeyID,
		TargetName:    apiKeyName,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogAPIKeyScopeEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID uint, scopeID uint, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    models.TargetTypeAPIKeyScope,
		TargetID:      &scopeID,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogStackEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName string, ip string, metadata map[string]any) error {
	return s.Log(LogEvent{
		EventType:     eventType,
		Success:       true,
		ActorUserID:   &actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		TargetType:    models.TargetTypeStack,
		TargetName:    stackName,
		ServerID:      &serverID,
		StackName:     stackName,
		Metadata:      metadata,
	})
}

func (s *AuditService) LogAuthorizationDenied(actorUserID *uint, actorUsername string, ip string, resource string, permission string, metadata map[string]any) error {
	if metadata == nil {
		metadata = make(map[string]any)
	}
	metadata["resource"] = resource
	metadata["permission"] = permission

	return s.Log(LogEvent{
		EventType:     EventAuthorizationDenied,
		Success:       false,
		ActorUserID:   actorUserID,
		ActorUsername: actorUsername,
		ActorIP:       ip,
		FailureReason: "permission denied",
		Metadata:      metadata,
	})
}

func (s *AuditService) GetLogs(filters AuditLogFilters) ([]models.SecurityAuditLog, error) {
	query := s.db.Model(&models.SecurityAuditLog{})

	if filters.EventType != "" {
		query = query.Where("event_type = ?", filters.EventType)
	}
	if filters.EventCategory != "" {
		query = query.Where("event_category = ?", filters.EventCategory)
	}
	if filters.Severity != "" {
		query = query.Where("severity = ?", filters.Severity)
	}
	if filters.ActorUserID != nil {
		query = query.Where("actor_user_id = ?", *filters.ActorUserID)
	}
	if filters.TargetUserID != nil {
		query = query.Where("target_user_id = ?", *filters.TargetUserID)
	}
	if filters.ServerID != nil {
		query = query.Where("server_id = ?", *filters.ServerID)
	}
	if filters.Success != nil {
		query = query.Where("success = ?", *filters.Success)
	}
	if !filters.StartDate.IsZero() {
		query = query.Where("created_at >= ?", filters.StartDate)
	}
	if !filters.EndDate.IsZero() {
		query = query.Where("created_at <= ?", filters.EndDate)
	}

	query = query.Order("created_at DESC")

	if filters.Limit > 0 {
		query = query.Limit(filters.Limit)
	}
	if filters.Offset > 0 {
		query = query.Offset(filters.Offset)
	}

	var logs []models.SecurityAuditLog
	if err := query.Find(&logs).Error; err != nil {
		return nil, err
	}

	return logs, nil
}

func (s *AuditService) GetLogByID(id uint) (*models.SecurityAuditLog, error) {
	var log models.SecurityAuditLog
	if err := s.db.First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (s *AuditService) CountLogs(filters AuditLogFilters) (int64, error) {
	query := s.db.Model(&models.SecurityAuditLog{})

	if filters.EventType != "" {
		query = query.Where("event_type = ?", filters.EventType)
	}
	if filters.EventCategory != "" {
		query = query.Where("event_category = ?", filters.EventCategory)
	}
	if filters.Severity != "" {
		query = query.Where("severity = ?", filters.Severity)
	}
	if filters.ActorUserID != nil {
		query = query.Where("actor_user_id = ?", *filters.ActorUserID)
	}
	if filters.TargetUserID != nil {
		query = query.Where("target_user_id = ?", *filters.TargetUserID)
	}
	if filters.ServerID != nil {
		query = query.Where("server_id = ?", *filters.ServerID)
	}
	if filters.Success != nil {
		query = query.Where("success = ?", *filters.Success)
	}
	if !filters.StartDate.IsZero() {
		query = query.Where("created_at >= ?", filters.StartDate)
	}
	if !filters.EndDate.IsZero() {
		query = query.Where("created_at <= ?", filters.EndDate)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}

	return count, nil
}

func (s *AuditService) DeleteOldLogs(retentionDays int) (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -retentionDays)

	result := s.db.Where("created_at < ?", cutoffDate).Delete(&models.SecurityAuditLog{})
	if result.Error != nil {
		s.logger.Error("failed to delete old audit logs",
			zap.Int("retention_days", retentionDays),
			zap.Error(result.Error),
		)
		return 0, result.Error
	}

	s.logger.Info("deleted old audit logs",
		zap.Int64("count", result.RowsAffected),
		zap.Int("retention_days", retentionDays),
	)

	return result.RowsAffected, nil
}

type AuditLogFilters struct {
	EventType     string
	EventCategory string
	Severity      string
	ActorUserID   *uint
	TargetUserID  *uint
	ServerID      *uint
	Success       *bool
	StartDate     time.Time
	EndDate       time.Time
	Limit         int
	Offset        int
}
