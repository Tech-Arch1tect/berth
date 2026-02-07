package models

import (
	"time"
)

type OperationLog struct {
	BaseModel
	UserID        uint            `json:"user_id" gorm:"not null;index"`
	User          User            `json:"user" gorm:"foreignKey:UserID"`
	ServerID      uint            `json:"server_id" gorm:"not null;index"`
	Server        Server          `json:"server" gorm:"foreignKey:ServerID"`
	StackName     string          `json:"stack_name" gorm:"not null;index"`
	OperationID   string          `json:"operation_id" gorm:"not null;index"`
	Command       string          `json:"command" gorm:"not null"`
	Options       string          `json:"options,omitempty" gorm:"type:text"`
	Services      string          `json:"services,omitempty" gorm:"type:text"`
	Status        OperationStatus `json:"status,omitempty" gorm:"not null;default:'completed'"`
	QueuedAt      *time.Time      `json:"queued_at,omitempty" gorm:"index"`
	StartTime     time.Time       `json:"start_time,omitempty" gorm:"not null;index"`
	EndTime       *time.Time      `json:"end_time,omitempty" gorm:"index"`
	LastMessageAt *time.Time      `json:"last_message_at,omitempty" gorm:"index"`
	Success       *bool           `json:"success,omitempty"`
	ExitCode      *int            `json:"exit_code,omitempty"`
	Duration      *int            `json:"duration_ms,omitempty"`
	Summary       string          `json:"summary,omitempty" gorm:"type:text"`
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
