package app

import (
	"berth/models"

	"go.uber.org/fx"
	"gorm.io/gorm"
)

type OperationLogAuditor interface {
	LogOperationCreate(log *models.OperationLog)
	LogOperationUpdate(log *models.OperationLog)
}

type SecurityLogAuditor interface {
	LogSecurityEvent(log *models.SecurityAuditLog)
}

type AuditCallbackParams struct {
	fx.In
	DB                   *gorm.DB
	OperationAuditLogger OperationLogAuditor `optional:"true"`
	SecurityAuditLogger  SecurityLogAuditor  `optional:"true"`
}

func RegisterAuditCallbacks(p AuditCallbackParams) {
	if p.OperationAuditLogger != nil {
		opLogger := p.OperationAuditLogger
		p.DB.Callback().Create().After("gorm:create").Register("berth:operation_log_after_create", func(tx *gorm.DB) {
			if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "operation_logs" {
				if log, ok := tx.Statement.Dest.(*models.OperationLog); ok {
					logCopy := *log
					go opLogger.LogOperationCreate(&logCopy)
				}
			}
		})
		p.DB.Callback().Update().After("gorm:update").Register("berth:operation_log_after_update", func(tx *gorm.DB) {
			if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "operation_logs" {
				if log, ok := tx.Statement.Dest.(*models.OperationLog); ok {
					logCopy := *log
					go opLogger.LogOperationUpdate(&logCopy)
				}
			}
		})
	}

	if p.SecurityAuditLogger != nil {
		secLogger := p.SecurityAuditLogger
		p.DB.Callback().Create().After("gorm:create").Register("berth:security_audit_log_after_create", func(tx *gorm.DB) {
			if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "security_audit_logs" {
				if log, ok := tx.Statement.Dest.(*models.SecurityAuditLog); ok {
					logCopy := *log
					go secLogger.LogSecurityEvent(&logCopy)
				}
			}
		})
	}
}
