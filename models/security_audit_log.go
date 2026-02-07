package models

import (
	"time"

	"gorm.io/gorm"
)

type SecurityAuditLog struct {
	BaseModel

	EventType     string `json:"event_type" gorm:"not null;index"`
	EventCategory string `json:"event_category" gorm:"not null;index"`
	Severity      string `json:"severity" gorm:"not null;index"`

	ActorUserID    *uint  `json:"actor_user_id" gorm:"index"`
	ActorUsername  string `json:"actor_username"`
	ActorIP        string `json:"actor_ip" gorm:"index"`
	ActorUserAgent string `json:"actor_user_agent" gorm:"type:text"`

	TargetUserID *uint  `json:"target_user_id" gorm:"index"`
	TargetType   string `json:"target_type"`
	TargetID     *uint  `json:"target_id" gorm:"index"`
	TargetName   string `json:"target_name"`

	Success       bool   `json:"success" gorm:"not null;index"`
	FailureReason string `json:"failure_reason" gorm:"type:text"`
	Metadata      string `json:"metadata" gorm:"type:text"`

	ServerID  *uint  `json:"server_id" gorm:"index"`
	StackName string `json:"stack_name" gorm:"index"`
	SessionID string `json:"session_id" gorm:"index"`
}

func (SecurityAuditLog) TableName() string {
	return "security_audit_logs"
}

const (
	CategoryAuth     = "auth"
	CategoryUserMgmt = "user_mgmt"
	CategoryRBAC     = "rbac"
	CategoryServer   = "server"
	CategoryFile     = "file"
	CategoryAPI      = "api"
	CategoryRegistry = "registry"
)

const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

const (
	TargetTypeUser               = "user"
	TargetTypeRole               = "role"
	TargetTypePermission         = "permission"
	TargetTypeServer             = "server"
	TargetTypeFile               = "file"
	TargetTypeSession            = "session"
	TargetTypeStack              = "stack"
	TargetTypeRegistryCredential = "registry_credential"
	TargetTypeAPIKey             = "api_key"
	TargetTypeAPIKeyScope        = "api_key_scope"
)

func (l *SecurityAuditLog) BeforeCreate(tx *gorm.DB) error {
	if l.CreatedAt.IsZero() {
		l.CreatedAt = time.Now()
	}
	return nil
}
