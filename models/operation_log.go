package models

import (
	"time"

	"gorm.io/gorm"
)

var OperationLogAuditLogger OperationLogAuditor

type OperationLogAuditor interface {
	LogOperationCreate(log *OperationLog)
	LogOperationUpdate(log *OperationLog)
}

type OperationLog struct {
	BaseModel
	UserID        uint            `json:"user_id" gorm:"not null;index"`
	User          User            `json:"user" gorm:"foreignKey:UserID"`
	ServerID      uint            `json:"server_id" gorm:"not null;index"`
	Server        Server          `json:"server" gorm:"foreignKey:ServerID"`
	StackName     string          `json:"stack_name" gorm:"not null;index"`
	OperationID   string          `json:"operation_id" gorm:"not null;index"`
	Command       string          `json:"command" gorm:"not null"`
	Options       string          `json:"options" gorm:"type:text"`
	Services      string          `json:"services" gorm:"type:text"`
	Status        OperationStatus `json:"status" gorm:"not null;default:'completed'"`
	WebhookID     *uint           `json:"webhook_id" gorm:"index"`
	Webhook       *Webhook        `json:"webhook,omitempty" gorm:"foreignKey:WebhookID"`
	QueuedAt      *time.Time      `json:"queued_at" gorm:"index"`
	StartTime     time.Time       `json:"start_time" gorm:"not null;index"`
	EndTime       *time.Time      `json:"end_time" gorm:"index"`
	LastMessageAt *time.Time      `json:"last_message_at" gorm:"index"`
	Success       *bool           `json:"success"`
	ExitCode      *int            `json:"exit_code"`
	Duration      *int            `json:"duration_ms"`
}

func (o *OperationLog) AfterCreate(tx *gorm.DB) error {
	if OperationLogAuditLogger != nil {
		logCopy := *o
		go OperationLogAuditLogger.LogOperationCreate(&logCopy)
	}
	return nil
}

func (o *OperationLog) AfterUpdate(tx *gorm.DB) error {
	if OperationLogAuditLogger != nil {
		logCopy := *o
		go OperationLogAuditLogger.LogOperationUpdate(&logCopy)
	}
	return nil
}

type OperationLogMessage struct {
	BaseModel
	OperationLogID uint         `json:"operation_log_id" gorm:"not null;index"`
	OperationLog   OperationLog `json:"operation_log" gorm:"foreignKey:OperationLogID"`
	MessageType    string       `json:"message_type" gorm:"not null;index"`
	MessageData    string       `json:"message_data" gorm:"type:text"`
	Timestamp      time.Time    `json:"timestamp" gorm:"not null;index"`
	SequenceNumber int          `json:"sequence_number" gorm:"not null"`
}
