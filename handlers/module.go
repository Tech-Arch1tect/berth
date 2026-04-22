package handlers

import (
	"berth/internal/security"

	"berth/internal/auth"
	"berth/internal/auth/totp"
	"berth/internal/inertia"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, authSvc *auth.Service, totpSvc *totp.Service, logger *zap.Logger, auditSvc *security.AuditService) *AuthHandler {
		return NewAuthHandler(db, inertiaSvc, authSvc, totpSvc, logger, auditSvc)
	}),
)
