package security

import (
	"berth/internal/logging"
	"berth/models"
	"time"

	brxLogging "github.com/tech-arch1tect/brx/services/logging"
)

type AuditLogger struct {
	fileLogger *logging.FileLogger
}

type AuditLogEntry struct {
	Timestamp     string `json:"timestamp"`
	LogID         uint   `json:"log_id"`
	EventType     string `json:"event_type"`
	EventCategory string `json:"event_category"`
	Severity      string `json:"severity"`
	ActorUserID   *uint  `json:"actor_user_id,omitempty"`
	ActorUsername string `json:"actor_username"`
	ActorIP       string `json:"actor_ip"`
	TargetUserID  *uint  `json:"target_user_id,omitempty"`
	TargetType    string `json:"target_type,omitempty"`
	TargetID      *uint  `json:"target_id,omitempty"`
	TargetName    string `json:"target_name,omitempty"`
	Success       bool   `json:"success"`
	FailureReason string `json:"failure_reason,omitempty"`
	Metadata      string `json:"metadata,omitempty"`
	ServerID      *uint  `json:"server_id,omitempty"`
	StackName     string `json:"stack_name,omitempty"`
	SessionID     string `json:"session_id,omitempty"`
}

func NewAuditLogger(enabled bool, logDir string, logger *brxLogging.Service) (*AuditLogger, error) {
	fileLogger, err := logging.NewFileLogger(enabled, logDir, "security", logger)
	if err != nil {
		return nil, err
	}

	return &AuditLogger{
		fileLogger: fileLogger,
	}, nil
}

func (a *AuditLogger) LogSecurityEvent(log *models.SecurityAuditLog) {
	entry := AuditLogEntry{
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		LogID:         log.ID,
		EventType:     log.EventType,
		EventCategory: log.EventCategory,
		Severity:      log.Severity,
		ActorUserID:   log.ActorUserID,
		ActorUsername: log.ActorUsername,
		ActorIP:       log.ActorIP,
		TargetUserID:  log.TargetUserID,
		TargetType:    log.TargetType,
		TargetID:      log.TargetID,
		TargetName:    log.TargetName,
		Success:       log.Success,
		FailureReason: log.FailureReason,
		Metadata:      log.Metadata,
		ServerID:      log.ServerID,
		StackName:     log.StackName,
		SessionID:     log.SessionID,
	}

	a.fileLogger.Log(entry)
}

func (a *AuditLogger) Close() error {
	return a.fileLogger.Close()
}
