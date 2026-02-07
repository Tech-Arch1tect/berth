package setup

import (
	"berth/internal/rbac"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, rbacSvc *rbac.Service, logger *logging.Service) *Service {
		return NewService(db, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
)
