package handlers

import (
	"net/http"

	"berth/internal/security"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type TOTPHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	totpSvc    *totp.Service
	authSvc    *auth.Service
	auditSvc   *security.AuditService
}

func NewTOTPHandler(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *auth.Service, auditSvc *security.AuditService) *TOTPHandler {
	return &TOTPHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		totpSvc:    totpSvc,
		authSvc:    authSvc,
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

	var secret *totp.TOTPSecret
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
	return c.Redirect(http.StatusFound, "/")
}
