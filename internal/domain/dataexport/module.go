package dataexport

import (
	"berth/internal/domain/rbac"
	"berth/internal/platform/inertia"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewHandlerWithDeps),
)

func NewServiceWithDeps(db *gorm.DB, logger *zap.Logger) *Service {
	return NewService(db, logger)
}

func NewHandlerWithDeps(inertiaSvc *inertia.Service, logger *zap.Logger, service *Service, rbacSvc *rbac.Service) *Handler {
	return NewHandler(inertiaSvc, logger, service, rbacSvc)
}
