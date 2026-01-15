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

func Module() fx.Option {
	return fx.Module("queue",
		fx.Provide(
			NewServiceWithDeps,
		),
	)
}

type ServiceDeps struct {
	fx.In
	DB           *gorm.DB
	OperationSvc *operations.Service
	RBACService  *rbac.Service
	Logger       *logging.Service
	AuditService *security.AuditService
	Config       *config.BerthConfig
}

func NewServiceWithDeps(deps ServiceDeps) *Service {
	return NewService(deps.DB, deps.OperationSvc, deps.RBACService, deps.Logger, deps.AuditService, deps.Config.Custom.OperationTimeoutSeconds)
}
