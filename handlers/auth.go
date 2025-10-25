package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"berth/internal/rbac"
	"berth/internal/security"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (h *AuthHandler) setRememberMeCookie(c echo.Context, token string, expiresAt time.Time) {
	sameSite := http.SameSiteLaxMode
	switch h.authSvc.GetRememberMeCookieSameSite() {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "none":
		sameSite = http.SameSiteNoneMode
	case "lax":
		sameSite = http.SameSiteLaxMode
	}

	maxAge := int(time.Until(expiresAt).Seconds())

	cookie := &http.Cookie{
		Name:     "remember_me",
		Value:    token,
		Expires:  expiresAt,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.authSvc.GetRememberMeCookieSecure(),
		SameSite: sameSite,
		Path:     "/",
	}
	c.SetCookie(cookie)
}

func (h *AuthHandler) clearRememberMeCookie(c echo.Context) {
	sameSite := http.SameSiteLaxMode
	switch h.authSvc.GetRememberMeCookieSameSite() {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "none":
		sameSite = http.SameSiteNoneMode
	case "lax":
		sameSite = http.SameSiteLaxMode
	}

	cookie := &http.Cookie{
		Name:     "remember_me",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   h.authSvc.GetRememberMeCookieSecure(),
		SameSite: sameSite,
		Path:     "/",
	}
	c.SetCookie(cookie)
}

type AuthHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	authSvc    *auth.Service
	totpSvc    *totp.Service
	logger     *logging.Service
	rbacSvc    *rbac.Service
	auditSvc   *security.AuditService
}

func NewAuthHandler(db *gorm.DB, inertiaSvc *inertia.Service, authSvc *auth.Service, totpSvc *totp.Service, logger *logging.Service, rbacSvc *rbac.Service, auditSvc *security.AuditService) *AuthHandler {
	return &AuthHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		authSvc:    authSvc,
		totpSvc:    totpSvc,
		logger:     logger,
		rbacSvc:    rbacSvc,
		auditSvc:   auditSvc,
	}
}

func (h *AuthHandler) ShowLogin(c echo.Context) error {
	if session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/")
	}

	var rememberMeDays int
	if h.authSvc.IsRememberMeEnabled() {
		rememberMeDays = int(h.authSvc.GetRememberMeExpiry().Hours() / 24)
	}

	return h.inertiaSvc.Render(c, "Auth/Login", map[string]any{
		"title":                    "Login",
		"emailVerificationEnabled": h.authSvc.IsEmailVerificationRequired(),
		"rememberMeEnabled":        h.authSvc.IsRememberMeEnabled(),
		"rememberMeDays":           rememberMeDays,
	})
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req struct {
		Username   string `form:"username" json:"username"`
		Password   string `form:"password" json:"password"`
		RememberMe bool   `form:"remember_me" json:"remember_me"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if req.Username == "" || req.Password == "" {
		session.AddFlashError(c, "Username and password are required")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	h.logger.Info("login attempt",
		zap.String("username", req.Username),
		zap.String("remote_ip", c.RealIP()),
		zap.String("user_agent", c.Request().UserAgent()),
	)

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		h.logger.Warn("login failed - user not found",
			zap.String("username", req.Username),
			zap.String("remote_ip", c.RealIP()),
		)
		_ = h.auditSvc.LogAuthEvent(
			security.EventAuthLoginFailure,
			nil,
			req.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			false,
			"user not found",
			nil,
		)
		session.AddFlashError(c, "Invalid credentials")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if err := h.authSvc.VerifyPassword(user.Password, req.Password); err != nil {
		h.logger.Warn("login failed - invalid password",
			zap.String("username", req.Username),
			zap.Uint("user_id", user.ID),
			zap.String("remote_ip", c.RealIP()),
		)
		_ = h.auditSvc.LogAuthEvent(
			security.EventAuthLoginFailure,
			&user.ID,
			req.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			false,
			"invalid password",
			nil,
		)
		session.AddFlashError(c, "Invalid credentials")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if h.authSvc.IsEmailVerificationRequired() && !h.authSvc.IsEmailVerified(user.Email) {

		session.AddFlashError(c, "Please verify your email before signing in.")
		session.AddFlashInfo(c, "You can resend the verification email using the form on this page.")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	session.LoginWithTOTPService(c, user.ID, h.totpSvc)

	now := time.Now()
	if err := h.db.Model(&user).Update("last_login_at", now).Error; err != nil {
		h.logger.Warn("failed to update last login time",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
	}

	if h.authSvc.IsRememberMeEnabled() && req.RememberMe {
		rememberToken, err := h.authSvc.CreateRememberMeToken(user.ID)
		if err != nil {
			h.logger.Error("failed to create remember me token",
				zap.Uint("user_id", user.ID),
				zap.Error(err),
			)
		} else {
			h.setRememberMeCookie(c, rememberToken.Token, rememberToken.ExpiresAt)
			h.logger.Info("remember me token created",
				zap.Uint("user_id", user.ID),
				zap.Time("expires_at", rememberToken.ExpiresAt),
			)
			_ = h.auditSvc.LogAuthEvent(
				security.EventAuthRememberMeCreated,
				&user.ID,
				req.Username,
				c.RealIP(),
				c.Request().UserAgent(),
				true,
				"",
				nil,
			)
		}
	}

	h.logger.Info("login successful",
		zap.String("username", req.Username),
		zap.Uint("user_id", user.ID),
		zap.String("remote_ip", c.RealIP()),
		zap.Bool("remember_me", req.RememberMe),
	)

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthLoginSuccess,
		&user.ID,
		req.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		map[string]any{
			"remember_me": req.RememberMe,
		},
	)

	session.AddFlashSuccess(c, "Login successful!")
	session.AddFlashInfo(c, "Welcome back! Your last login was recorded.")

	return c.Redirect(http.StatusFound, "/")
}

func (h *AuthHandler) Logout(c echo.Context) error {
	userID := session.GetUserID(c)

	var userIDPtr *uint
	var username string

	if userID != nil {
		if userIDUint, ok := userID.(uint); ok && userIDUint > 0 {
			userIDPtr = &userIDUint

			var user models.User
			if err := h.db.First(&user, userIDUint).Error; err == nil {
				username = user.Username
			}

			if h.authSvc.IsRememberMeEnabled() {
				if err := h.authSvc.InvalidateRememberMeTokens(userIDUint); err != nil {
					h.logger.Error("failed to invalidate remember me tokens", zap.Uint("user_id", userIDUint), zap.Error(err))
				} else {
					_ = h.auditSvc.LogAuthEvent(
						security.EventAuthRememberMeInvalidated,
						userIDPtr,
						username,
						c.RealIP(),
						c.Request().UserAgent(),
						true,
						"",
						nil,
					)
				}
			}
		}

		h.clearRememberMeCookie(c)
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthLogout,
		userIDPtr,
		username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	session.Logout(c)
	session.AddFlashSuccess(c, "Logged out successfully")
	return c.Redirect(http.StatusFound, "/auth/login")
}

func (h *AuthHandler) Profile(c echo.Context) error {
	return h.inertiaSvc.Render(c, "Profile", map[string]any{
		"title": "Profile",
	})
}

func (h *AuthHandler) ShowPasswordReset(c echo.Context) error {
	if session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/")
	}

	return h.inertiaSvc.Render(c, "Auth/PasswordReset", map[string]any{})
}

func (h *AuthHandler) RequestPasswordReset(c echo.Context) error {
	var req struct {
		Email string `form:"email" json:"email"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	if req.Email == "" {
		session.AddFlashError(c, "Email is required")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			session.AddFlashInfo(c, "If an account with that email exists, you will receive a password reset email shortly.")
			return c.Redirect(http.StatusFound, "/auth/login")
		}
		session.AddFlashError(c, "Something went wrong. Please try again.")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	if err := h.authSvc.RequestPasswordReset(req.Email); err != nil {
		if strings.Contains(err.Error(), "disabled") {
			session.AddFlashError(c, "Password reset is currently disabled")
		} else if strings.Contains(err.Error(), "mail service is not configured") {
			session.AddFlashError(c, "Email service is not properly configured. Please contact support.")
		} else if strings.Contains(err.Error(), "failed to send password reset email") {
			session.AddFlashError(c, "Failed to send password reset email. Please try again or contact support.")
		} else {
			session.AddFlashError(c, "Something went wrong. Please try again or contact support.")
		}
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthPasswordResetRequested,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	session.AddFlashInfo(c, "If an account with that email exists, you will receive a password reset email shortly.")
	return c.Redirect(http.StatusFound, "/auth/login")
}

func (h *AuthHandler) ShowPasswordResetConfirm(c echo.Context) error {
	if session.IsAuthenticated(c) {
		return c.Redirect(http.StatusFound, "/")
	}

	token := c.QueryParam("token")
	if token == "" {
		session.AddFlashError(c, "Invalid password reset link")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	_, err := h.authSvc.ValidatePasswordResetToken(token)
	if err != nil {
		var message string
		switch err {
		case auth.ErrPasswordResetTokenExpired:
			message = "This password reset link has expired. Please request a new one."
		case auth.ErrPasswordResetTokenUsed:
			message = "This password reset link has already been used."
		case auth.ErrPasswordResetTokenInvalid:
			message = "Invalid password reset link."
		default:
			message = "Invalid password reset link."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	return h.inertiaSvc.Render(c, "Auth/PasswordResetConfirm", map[string]any{
		"token": token,
	})
}

func (h *AuthHandler) ConfirmPasswordReset(c echo.Context) error {
	var req struct {
		Token           string `form:"token" json:"token"`
		Password        string `form:"password" json:"password"`
		PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	if req.Token == "" {
		session.AddFlashError(c, "Invalid password reset link")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	if req.Password == "" || req.PasswordConfirm == "" {
		session.AddFlashError(c, "Password and confirmation are required")
		return c.Redirect(http.StatusFound, fmt.Sprintf("/auth/password-reset/confirm?token=%s", req.Token))
	}

	if req.Password != req.PasswordConfirm {
		session.AddFlashError(c, "Passwords do not match")
		return c.Redirect(http.StatusFound, fmt.Sprintf("/auth/password-reset/confirm?token=%s", req.Token))
	}

	tokenData, err := h.authSvc.ValidatePasswordResetToken(req.Token)
	if err != nil {
		var message string
		switch err {
		case auth.ErrPasswordResetTokenExpired:
			message = "This password reset link has expired. Please request a new one."
		case auth.ErrPasswordResetTokenUsed:
			message = "This password reset link has already been used."
		case auth.ErrPasswordResetTokenInvalid:
			message = "Invalid password reset link."
		default:
			message = "Invalid password reset link."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	var user models.User
	if err := h.db.Where("email = ?", tokenData.Email).First(&user).Error; err != nil {
		session.AddFlashError(c, "User not found")
		return c.Redirect(http.StatusFound, "/auth/password-reset")
	}

	if err := h.authSvc.CompletePasswordReset(req.Token, req.Password); err != nil {
		var message string
		if strings.Contains(err.Error(), "password must") {
			message = err.Error()
		} else {
			message = "Something went wrong. Please try again."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, fmt.Sprintf("/auth/password-reset/confirm?token=%s", req.Token))
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthPasswordResetCompleted,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	session.AddFlashSuccess(c, "Your password has been reset successfully. Please log in with your new password.")
	return c.Redirect(http.StatusFound, "/auth/login")
}

func (h *AuthHandler) ShowVerifyEmail(c echo.Context) error {
	token := c.QueryParam("token")
	if token == "" {
		session.AddFlashError(c, "Invalid verification link")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	_, err := h.authSvc.ValidateEmailVerificationToken(token)
	if err != nil {
		var message string
		switch err {
		case auth.ErrEmailVerificationTokenExpired:
			message = "This verification link has expired. Please request a new one."
		case auth.ErrEmailVerificationTokenUsed:
			message = "This email has already been verified."
		case auth.ErrEmailVerificationTokenInvalid:
			message = "Invalid verification link."
		default:
			message = "Invalid verification link."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	return h.inertiaSvc.Render(c, "Auth/VerifyEmail", map[string]any{
		"token": token,
	})
}

func (h *AuthHandler) VerifyEmail(c echo.Context) error {
	token := c.QueryParam("token")
	if token == "" {
		session.AddFlashError(c, "Invalid verification link")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	tokenData, err := h.authSvc.ValidateEmailVerificationToken(token)
	if err != nil {
		var message string
		switch err {
		case auth.ErrEmailVerificationTokenExpired:
			message = "This verification link has expired. Please request a new one."
		case auth.ErrEmailVerificationTokenUsed:
			message = "This email has already been verified."
		case auth.ErrEmailVerificationTokenInvalid:
			message = "Invalid verification link."
		default:
			message = "Invalid verification link."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	var user models.User
	if err := h.db.Where("email = ?", tokenData.Email).First(&user).Error; err != nil {
		session.AddFlashError(c, "User not found")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if err := h.authSvc.VerifyEmail(token); err != nil {
		var message string
		if err == auth.ErrEmailVerificationTokenExpired || err == auth.ErrEmailVerificationTokenUsed || err == auth.ErrEmailVerificationTokenInvalid {
			message = "Invalid verification link."
		} else {
			message = "Something went wrong. Please try again."
		}
		session.AddFlashError(c, message)
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthEmailVerified,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	session.AddFlashSuccess(c, "Your email has been verified successfully! You can now sign in.")
	return c.Redirect(http.StatusFound, "/auth/login")
}

func (h *AuthHandler) ResendVerification(c echo.Context) error {
	var req struct {
		Email string `form:"email" json:"email"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if req.Email == "" {
		session.AddFlashError(c, "Email is required")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			session.AddFlashInfo(c, "If an account with that email exists, a verification email will be sent.")
			return c.Redirect(http.StatusFound, "/auth/login")
		}
		session.AddFlashError(c, "Something went wrong. Please try again.")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if !h.authSvc.IsEmailVerificationRequired() {
		session.AddFlashError(c, "Email verification is currently disabled")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if user.EmailVerifiedAt != nil {
		session.AddFlashInfo(c, "This email is already verified.")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	if err := h.authSvc.RequestEmailVerification(req.Email); err != nil {
		h.logger.Error("failed to resend email verification", zap.String("email", req.Email), zap.Error(err))

		var errorMsg string
		if strings.Contains(err.Error(), "mail service is not configured") {
			errorMsg = "Email service is not configured. Please contact support."
		} else if strings.Contains(err.Error(), "failed to send email verification email") {
			errorMsg = "Failed to send verification email. Mail service may be unavailable."
		} else {
			errorMsg = fmt.Sprintf("Verification email failed: %s", err.Error())
		}

		session.AddFlashError(c, errorMsg)
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	session.AddFlashInfo(c, "If an account with that email exists, a verification email will be sent.")
	return c.Redirect(http.StatusFound, "/auth/login")
}
