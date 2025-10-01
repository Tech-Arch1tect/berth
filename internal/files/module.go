package files

import (
	"berth/internal/security"

	"go.uber.org/fx"
	"gorm.io/gorm"
)

type APIHandlerDeps struct {
	fx.In
	DB           *gorm.DB
	Service      *Service
	AuditService *security.AuditService
}

func NewAPIHandlerWithDeps(deps APIHandlerDeps) *APIHandler {
	return NewAPIHandler(deps.DB, deps.Service, deps.AuditService)
}

var Module = fx.Options(
	fx.Provide(
		NewService,
		NewHandler,
		NewAPIHandlerWithDeps,
	),
)
