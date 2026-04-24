package rbac

import (
	"berth/internal/domain/security"

	"berth/internal/domain/auth"
	"berth/internal/domain/auth/totp"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewService),
	fx.Provide(NewMiddleware),
	fx.Provide(NewRBACHandler),
	fx.Provide(func(db *gorm.DB, rbacSvc *Service, totpSvc *totp.Service, authSvc *auth.Service, auditService *security.AuditService) *APIHandler {
		return NewAPIHandler(db, rbacSvc, totpSvc, authSvc, auditService)
	}),
)
