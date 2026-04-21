package auth

import (
	"net/http"

	"berth/internal/auth/totp"
	"berth/internal/inertia"
	"berth/internal/security"
	"berth/internal/session"
	"berth/models"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type totpAuditLogger interface {
	LogAuthEvent(eventType string, userID *uint, username, ip, userAgent string, success bool, failureReason string, metadata map[string]any) error
}

type TOTPHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	totpSvc    *totp.Service
	authSvc    *Service
	logger     *zap.Logger
	auditSvc   totpAuditLogger
}

func NewTOTPHandler(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *Service, logger *zap.Logger, auditSvc totpAuditLogger) *TOTPHandler {
	return &TOTPHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		totpSvc:    totpSvc,
		authSvc:    authSvc,
		logger:     logger,
		auditSvc:   auditSvc,
	}
}

func (h *TOTPHandler) ShowSetup(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "User not found")
	}

	if h.totpSvc.IsUserTOTPEnabled(userID) {
		session.AddFlashError(c, "TOTP is already enabled for your account")
		return c.Redirect(http.StatusFound, "/profile")
	}

	existing, err := h.totpSvc.GetSecret(userID)
	if err != nil && err != totp.ErrSecretNotFound {
		session.AddFlashError(c, "Failed to retrieve TOTP information")
		return c.Redirect(http.StatusFound, "/profile")
	}

	var secret *models.TOTPSecret
	if existing != nil {
		secret = existing
	} else {
		secret, err = h.totpSvc.GenerateSecret(userID, user.Email)
		if err != nil {
			session.AddFlashError(c, "Failed to generate TOTP secret")
			return c.Redirect(http.StatusFound, "/profile")
		}
		_ = h.auditSvc.LogAuthEvent(
			security.EventTOTPSetupInitiated,
			&userID,
			user.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			true,
			"",
			nil,
		)
	}

	qrCodeURI, err := h.totpSvc.GenerateProvisioningURI(secret, user.Email)
	if err != nil {
		session.AddFlashError(c, "Failed to generate QR code")
		return c.Redirect(http.StatusFound, "/profile")
	}

	return h.inertiaSvc.Render(c, "Auth/TOTPSetup", map[string]any{
		"title":     "Setup Two-Factor Authentication",
		"qrCodeURI": qrCodeURI,
		"secret":    secret.Secret,
	})
}

func (h *TOTPHandler) ShowVerify(c echo.Context) error {
	if !session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if session.IsTOTPVerified(c) {
		return c.Redirect(http.StatusFound, "/")
	}

	userID := session.GetUserIDAsUint(c)
	if !h.totpSvc.IsUserTOTPEnabled(userID) {
		session.SetTOTPVerified(c, true)
		return c.Redirect(http.StatusFound, "/")
	}

	return h.inertiaSvc.Render(c, "Auth/TOTPVerify", map[string]any{
		"title": "Two-Factor Authentication",
	})
}

func (h *TOTPHandler) VerifyTOTP(c echo.Context) error {
	if !session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	userID := session.GetUserIDAsUint(c)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		session.AddFlashError(c, "User not found")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	var req struct {
		Code string `form:"code" json:"code"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	if req.Code == "" {
		session.AddFlashError(c, "TOTP code is required")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	if err := h.totpSvc.VerifyUserCode(userID, req.Code); err != nil {
		_ = h.auditSvc.LogAuthEvent(
			security.EventTOTPVerificationFailure,
			&userID,
			user.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			false,
			"invalid code",
			nil,
		)
		session.AddFlashError(c, "Invalid TOTP code. Please try again.")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventTOTPVerificationSuccess,
		&userID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	session.SetTOTPVerified(c, true)

	if pendingRememberMe := session.Get(c, "pending_remember_me"); pendingRememberMe == true {
		if h.authSvc != nil && h.authSvc.IsRememberMeEnabled() {
			rememberToken, err := h.authSvc.CreateRememberMeToken(userID)
			if err != nil {
				if h.logger != nil {
					h.logger.Error("failed to create remember me token after TOTP verification",
						zap.Uint("user_id", userID),
						zap.Error(err),
					)
				}
			} else {
				setRememberCookie(c, h.authSvc, rememberToken.Token, rememberToken.ExpiresAt)
				if h.logger != nil {
					h.logger.Info("remember me token created after TOTP verification",
						zap.Uint("user_id", userID),
						zap.Time("expires_at", rememberToken.ExpiresAt),
					)
				}
				_ = h.auditSvc.LogAuthEvent(
					security.EventAuthRememberMeCreated,
					&userID,
					user.Username,
					c.RealIP(),
					c.Request().UserAgent(),
					true,
					"",
					nil,
				)
			}
		}
		session.Set(c, "pending_remember_me", nil)
	}

	return c.Redirect(http.StatusFound, "/")
}
