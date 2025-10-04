package registry

import (
	"berth/internal/rbac"
	"berth/utils"

	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Module("registry",
	fx.Provide(
		func(db *gorm.DB, crypto *utils.Crypto, logger *logging.Service) *Service {
			return NewService(db, crypto, logger)
		},
		func(svc *Service, rbacSvc *rbac.Service, db *gorm.DB) *APIHandler {
			return NewAPIHandler(svc, rbacSvc, db)
		},
		func(svc *Service, rbacSvc *rbac.Service, inertiaSvc *inertia.Service) *Handler {
			return NewHandler(svc, rbacSvc, inertiaSvc)
		},
	),
)
