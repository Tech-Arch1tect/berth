package operations

import (
	"time"

	"berth/internal/logging"
	"berth/models"

	brxLogging "github.com/tech-arch1tect/brx/services/logging"
)

type AuditLogger struct {
	fileLogger *logging.FileLogger
}

type AuditLogEntry struct {
	Timestamp   string `json:"timestamp"`
	LogID       uint   `json:"log_id"`
	UserID      uint   `json:"user_id"`
	ServerID    uint   `json:"server_id"`
	StackName   string `json:"stack_name"`
	OperationID string `json:"operation_id"`
	Command     string `json:"command"`
	Options     string `json:"options,omitempty"`
	Services    string `json:"services,omitempty"`
	Status      string `json:"status"`
	ExitCode    *int   `json:"exit_code,omitempty"`
	Duration    *int   `json:"duration_ms,omitempty"`
}

func NewAuditLogger(enabled bool, logDir string, logger *brxLogging.Service, maxSizeBytes int64) (*AuditLogger, error) {
	fileLogger, err := logging.NewFileLogger(enabled, logDir, "operations", logger, maxSizeBytes)
	if err != nil {
		return nil, err
	}

	return &AuditLogger{
		fileLogger: fileLogger,
	}, nil
}

func (a *AuditLogger) LogOperationCreate(log *models.OperationLog) {
	entry := AuditLogEntry{
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		LogID:       log.ID,
		UserID:      log.UserID,
		ServerID:    log.ServerID,
		StackName:   log.StackName,
		OperationID: log.OperationID,
		Command:     log.Command,
		Options:     log.Options,
		Services:    log.Services,
		Status:      "started",
	}

	a.fileLogger.Log(entry)
}

func (a *AuditLogger) LogOperationUpdate(log *models.OperationLog) {
	status := "unknown"
	if log.Success != nil {
		if *log.Success {
			status = "success"
		} else {
			status = "failed"
		}
	}

	entry := AuditLogEntry{
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		LogID:       log.ID,
		UserID:      log.UserID,
		ServerID:    log.ServerID,
		StackName:   log.StackName,
		OperationID: log.OperationID,
		Command:     log.Command,
		Status:      status,
		ExitCode:    log.ExitCode,
		Duration:    log.Duration,
	}

	a.fileLogger.Log(entry)
}

func (a *AuditLogger) Close() error {
	return a.fileLogger.Close()
}
