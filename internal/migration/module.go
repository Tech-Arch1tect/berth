package migration

import (
	"berth/internal/rbac"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewHandlerWithDeps),
)

func NewServiceWithDeps(db *gorm.DB, logger *logging.Service) *Service {
	return NewService(db, logger)
}

func NewHandlerWithDeps(inertiaSvc *inertia.Service, logger *logging.Service, service *Service, rbacSvc *rbac.Service) *Handler {
	return NewHandler(inertiaSvc, logger, service, rbacSvc)
}
