package setup

import (
	"berth/internal/domain/rbac"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, rbacSvc *rbac.Service, logger *zap.Logger) *Service {
		return NewService(db, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
)
