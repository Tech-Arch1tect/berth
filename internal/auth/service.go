package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"berth/internal/auth/tokens"
	"berth/internal/auth/totp"
	"berth/internal/config"
	"berth/internal/inertia"
	"berth/internal/security"
	"berth/internal/session"
	"berth/models"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type (
	PasswordResetToken     = models.PasswordResetToken
	RememberMeToken        = models.RememberMeToken
	EmailVerificationToken = models.EmailVerificationToken
)

var (
	ErrPasswordHashingFailed = errors.New("failed to hash password")
	ErrInvalidCredentials    = errors.New("invalid credentials")

	ErrPasswordResetDisabled     = errors.New("password reset is disabled")
	ErrPasswordResetTokenInvalid = errors.New("invalid or expired password reset token")
	ErrPasswordResetTokenExpired = errors.New("password reset token has expired")
	ErrPasswordResetTokenUsed    = errors.New("password reset token has already been used")

	ErrEmailVerificationDisabled     = errors.New("email verification is disabled")
	ErrEmailVerificationTokenInvalid = errors.New("invalid or expired email verification token")
	ErrEmailVerificationTokenExpired = errors.New("email verification token has expired")
	ErrEmailVerificationTokenUsed    = errors.New("email verification token has already been used")

	ErrRememberMeDisabled     = errors.New("remember me functionality is disabled")
	ErrRememberMeTokenInvalid = errors.New("invalid or expired remember me token")
	ErrRememberMeTokenExpired = errors.New("remember me token has expired")
	ErrRememberMeTokenUsed    = errors.New("remember me token has already been used")
)

type MailService interface {
	SendTemplate(templateName string, to []string, subject string, data map[string]any) error
}

type SessionInvalidator interface {
	RevokeAllUserSessions(userID uint) error
}

type Service struct {
	config             *config.Config
	db                 *gorm.DB
	mailService        MailService
	sessionInvalidator SessionInvalidator
	logger             *zap.Logger
}

func NewService(cfg *config.Config, db *gorm.DB, mailService MailService, sessionInvalidator SessionInvalidator, logger *zap.Logger) *Service {
	if cfg.Auth.BcryptCost < bcrypt.MinCost || cfg.Auth.BcryptCost > bcrypt.MaxCost {
		cfg.Auth.BcryptCost = bcrypt.DefaultCost
	}
	return &Service{
		config:             cfg,
		db:                 db,
		mailService:        mailService,
		sessionInvalidator: sessionInvalidator,
		logger:             logger,
	}
}

func generateHexToken(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate secure token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

var Module = fx.Module("auth",
	fx.Provide(NewService),
	fx.Provide(func(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *Service, logger *zap.Logger, auditSvc *security.AuditService) *TOTPHandler {
		return NewTOTPHandler(db, inertiaSvc, totpSvc, authSvc, logger, auditSvc)
	}),
	fx.Provide(func(db *gorm.DB, authSvc *Service, tokensSvc *tokens.Service, totpSvc *totp.Service, sessionSvc *session.Service, logger *zap.Logger, auditSvc *security.AuditService) *APIHandler {
		return NewAPIHandler(db, authSvc, tokensSvc, totpSvc, sessionSvc, logger, auditSvc)
	}),
)
