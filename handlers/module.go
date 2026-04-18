package handlers

import (
	"berth/internal/security"
	"berth/internal/server"

	"berth/internal/auth"
	"berth/internal/auth/tokens"
	"berth/internal/auth/totp"
	"berth/internal/inertia"
	"berth/internal/session"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(inertiaSvc *inertia.Service, db *gorm.DB, logger *zap.Logger, serverSvc *server.Service) *DashboardHandler {
		return NewDashboardHandler(inertiaSvc, db, logger, serverSvc)
	}),
	fx.Provide(func(inertiaSvc *inertia.Service, db *gorm.DB, logger *zap.Logger, serverSvc *server.Service) *StacksHandler {
		return NewStacksHandler(inertiaSvc, db, logger, serverSvc)
	}),
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, authSvc *auth.Service, totpSvc *totp.Service, logger *zap.Logger, auditSvc *security.AuditService) *AuthHandler {
		return NewAuthHandler(db, inertiaSvc, authSvc, totpSvc, logger, auditSvc)
	}),
	fx.Provide(func(db *gorm.DB, authSvc *auth.Service, tokensSvc *tokens.Service, totpSvc *totp.Service, sessionSvc *session.Service, logger *zap.Logger, auditSvc *security.AuditService) *MobileAuthHandler {
		return NewMobileAuthHandler(db, authSvc, tokensSvc, totpSvc, sessionSvc, logger, auditSvc)
	}),
	fx.Provide(NewSessionHandler),
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *auth.Service, logger *zap.Logger, auditSvc *security.AuditService) *TOTPHandler {
		return NewTOTPHandler(db, inertiaSvc, totpSvc, authSvc, logger, auditSvc)
	}),
	fx.Provide(NewVersionHandler),
)
