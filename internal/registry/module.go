package registry

import (
	"berth/internal/rbac"

	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewService),
	fx.Provide(func(service *Service, rbacSvc *rbac.Service, db *gorm.DB) *APIHandler {
		return NewAPIHandler(service, rbacSvc, db)
	}),
	fx.Provide(NewHandler),
)
