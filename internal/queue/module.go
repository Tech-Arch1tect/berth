package queue

import (
	"berth/internal/config"
	"berth/internal/operations"
	"berth/internal/rbac"
	"berth/internal/security"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
)

func NewServiceWithDeps(db *gorm.DB, operationSvc *operations.Service, rbacSvc *rbac.Service, logger *logging.Service, auditService *security.AuditService, cfg *config.BerthConfig) *Service {
	return NewService(db, operationSvc, rbacSvc, logger, auditService, cfg.Custom.OperationTimeoutSeconds)
}
