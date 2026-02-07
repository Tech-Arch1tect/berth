package handlers

import (
	"berth/internal/security"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(inertiaSvc *inertia.Service, db *gorm.DB, logger *logging.Service, serverSvc *server.Service) *DashboardHandler {
		return NewDashboardHandler(inertiaSvc, db, logger, serverSvc)
	}),
	fx.Provide(func(inertiaSvc *inertia.Service, db *gorm.DB, logger *logging.Service, serverSvc *server.Service) *StacksHandler {
		return NewStacksHandler(inertiaSvc, db, logger, serverSvc)
	}),
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, authSvc *auth.Service, totpSvc *totp.Service, logger *logging.Service, auditSvc *security.AuditService) *AuthHandler {
		return NewAuthHandler(db, inertiaSvc, authSvc, totpSvc, logger, auditSvc)
	}),
	fx.Provide(func(db *gorm.DB, authSvc *auth.Service, jwtSvc *jwtservice.Service, refreshTokenSvc refreshtoken.RefreshTokenService, totpSvc *totp.Service, sessionSvc session.SessionService, logger *logging.Service, auditSvc *security.AuditService) *MobileAuthHandler {
		return NewMobileAuthHandler(db, authSvc, jwtSvc, refreshTokenSvc, totpSvc, sessionSvc, logger, auditSvc)
	}),
	fx.Provide(NewSessionHandler),
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *auth.Service, logger *logging.Service, auditSvc *security.AuditService) *TOTPHandler {
		return NewTOTPHandler(db, inertiaSvc, totpSvc, authSvc, logger, auditSvc)
	}),
	fx.Provide(NewVersionHandler),
)
