package apikey

import (
	"berth/internal/security"

	"github.com/tech-arch1tect/brx/services/inertia"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(service *Service, inertiaSvc *inertia.Service, auditService *security.AuditService, db *gorm.DB) *Handler {
		return NewHandler(service, inertiaSvc, auditService, db)
	}),
)
