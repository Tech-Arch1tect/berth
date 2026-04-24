package queue

import (
	"berth/internal/domain/operations"
	"berth/internal/domain/rbac"
	"berth/internal/domain/security"
	"berth/internal/pkg/config"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
)

func NewServiceWithDeps(db *gorm.DB, operationSvc *operations.Service, rbacSvc *rbac.Service, logger *zap.Logger, auditService *security.AuditService, cfg *config.Config) *Service {
	return NewService(db, operationSvc, rbacSvc, logger, auditService, cfg.Custom.OperationTimeoutSeconds)
}
