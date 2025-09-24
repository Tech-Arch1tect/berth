package queue

import (
	"berth/internal/operations"
	"berth/internal/rbac"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func Module() fx.Option {
	return fx.Module("queue",
		fx.Provide(
			NewService,
		),
	)
}

type ServiceDeps struct {
	fx.In
	DB           *gorm.DB
	OperationSvc *operations.Service
	RBACService  *rbac.Service
	Logger       *logging.Service
}

func NewServiceWithDeps(deps ServiceDeps) *Service {
	return NewService(deps.DB, deps.OperationSvc, deps.RBACService, deps.Logger)
}
