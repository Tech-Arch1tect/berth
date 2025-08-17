package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"

	"brx-starter-kit/models"
)

type TOTPHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	totpSvc    *totp.Service
	authSvc    *auth.Service
}

func NewTOTPHandler(db *gorm.DB, inertiaSvc *inertia.Service, totpSvc *totp.Service, authSvc *auth.Service) *TOTPHandler {
	return &TOTPHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		totpSvc:    totpSvc,
		authSvc:    authSvc,
	}
}

func (h *TOTPHandler) ShowSetup(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "User not found")
	}

	if h.totpSvc.IsUserTOTPEnabled(userID) {
		session.SetFlash(c, "TOTP is already enabled for your account")
		return c.Redirect(http.StatusFound, "/profile")
	}

	existing, err := h.totpSvc.GetSecret(userID)
	if err != nil && err != totp.ErrSecretNotFound {
		session.SetFlash(c, "Failed to retrieve TOTP information")
		return c.Redirect(http.StatusFound, "/profile")
	}

	var secret *totp.TOTPSecret
	if existing != nil {
		secret = existing
	} else {
		secret, err = h.totpSvc.GenerateSecret(userID, user.Email)
		if err != nil {
			session.SetFlash(c, "Failed to generate TOTP secret")
			return c.Redirect(http.StatusFound, "/profile")
		}
	}

	qrCodeURI, err := h.totpSvc.GenerateProvisioningURI(secret, user.Email)
	if err != nil {
		session.SetFlash(c, "Failed to generate QR code")
		return c.Redirect(http.StatusFound, "/profile")
	}

	flash := session.GetFlashWithType(c)

	return h.inertiaSvc.Render(c, "Auth/TOTPSetup", map[string]any{
		"title":     "Setup Two-Factor Authentication",
		"qrCodeURI": qrCodeURI,
		"secret":    secret.Secret,
		"flash":     flash,
	})
}

func (h *TOTPHandler) EnableTOTP(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	var req struct {
		Code string `form:"code" json:"code"`
	}

	if err := c.Bind(&req); err != nil {
		session.SetFlash(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/totp/setup")
	}

	if req.Code == "" {
		session.SetFlash(c, "TOTP code is required")
		return c.Redirect(http.StatusFound, "/auth/totp/setup")
	}

	if err := h.totpSvc.EnableTOTP(userID, req.Code); err != nil {
		if err == totp.ErrInvalidCode {
			session.SetFlash(c, "Invalid TOTP code. Please try again.")
		} else {
			session.SetFlash(c, "Failed to enable TOTP")
		}
		return c.Redirect(http.StatusFound, "/auth/totp/setup")
	}

	session.SetTOTPEnabled(c, true)
	session.SetFlashSuccess(c, "Two-factor authentication has been enabled successfully!")
	return c.Redirect(http.StatusFound, "/profile")
}

func (h *TOTPHandler) DisableTOTP(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	var req struct {
		Code     string `form:"code" json:"code"`
		Password string `form:"password" json:"password"`
	}

	if err := c.Bind(&req); err != nil {
		session.SetFlash(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/profile")
	}

	if req.Code == "" || req.Password == "" {
		session.SetFlash(c, "TOTP code and password are required to disable 2FA")
		return c.Redirect(http.StatusFound, "/profile")
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		session.SetFlash(c, "User not found")
		return c.Redirect(http.StatusFound, "/profile")
	}

	if err := h.authSvc.VerifyPassword(user.Password, req.Password); err != nil {
		session.SetFlash(c, "Invalid password")
		return c.Redirect(http.StatusFound, "/profile")
	}

	if err := h.totpSvc.VerifyUserCode(userID, req.Code); err != nil {
		session.SetFlash(c, "Invalid TOTP code")
		return c.Redirect(http.StatusFound, "/profile")
	}

	if err := h.totpSvc.DisableTOTP(userID); err != nil {
		session.SetFlash(c, "Failed to disable TOTP")
		return c.Redirect(http.StatusFound, "/profile")
	}

	session.SetTOTPEnabled(c, false)
	session.SetFlashSuccess(c, "Two-factor authentication has been disabled")
	return c.Redirect(http.StatusFound, "/profile")
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

	flash := session.GetFlashWithType(c)

	return h.inertiaSvc.Render(c, "Auth/TOTPVerify", map[string]any{
		"title": "Two-Factor Authentication",
		"flash": flash,
	})
}

func (h *TOTPHandler) VerifyTOTP(c echo.Context) error {
	if !session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	userID := session.GetUserIDAsUint(c)

	var req struct {
		Code string `form:"code" json:"code"`
	}

	if err := c.Bind(&req); err != nil {
		session.SetFlash(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	if req.Code == "" {
		session.SetFlash(c, "TOTP code is required")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	if err := h.totpSvc.VerifyUserCode(userID, req.Code); err != nil {
		session.SetFlash(c, "Invalid TOTP code. Please try again.")
		return c.Redirect(http.StatusFound, "/auth/totp/verify")
	}

	session.SetTOTPVerified(c, true)
	return c.Redirect(http.StatusFound, "/")
}

func (h *TOTPHandler) GetTOTPStatus(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)
	enabled := h.totpSvc.IsUserTOTPEnabled(userID)

	return c.JSON(http.StatusOK, map[string]any{
		"enabled": enabled,
	})
}
