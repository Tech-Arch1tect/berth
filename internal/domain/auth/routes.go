package auth

import "github.com/labstack/echo/v4"

type TightAuthFactory func(name string, rate int) echo.MiddlewareFunc

func (h *Handler) RegisterPublicWebAuthRoutes(g *echo.Group, tightAuth TightAuthFactory) {
	g.GET("/login", h.ShowLogin)
	g.POST("/login", h.Login, tightAuth("web_auth_login", 5))
	g.POST("/logout", h.Logout)
	g.GET("/password-reset", h.ShowPasswordReset)
	g.POST("/password-reset", h.RequestPasswordReset, tightAuth("web_auth_password_reset", 5))
	g.GET("/password-reset/confirm", h.ShowPasswordResetConfirm)
	g.POST("/password-reset/confirm", h.ConfirmPasswordReset, tightAuth("web_auth_password_reset_confirm", 5))
	g.GET("/verify-email", h.ShowVerifyEmail)
	g.POST("/verify-email", h.VerifyEmail, tightAuth("web_auth_verify_email", 5))
	g.POST("/resend-verification", h.ResendVerification, tightAuth("web_auth_resend_verification", 3))
}

func (h *Handler) RegisterProtectedWebRoutes(g *echo.Group) {
	g.GET("/profile", h.Profile)
}

func (h *TOTPHandler) RegisterPublicWebAuthRoutes(g *echo.Group, tightAuth TightAuthFactory) {
	g.GET("/totp/verify", h.ShowVerify)
	g.POST("/totp/verify", h.VerifyTOTP, tightAuth("web_auth_totp_verify", 3))
}

func (h *TOTPHandler) RegisterProtectedWebRoutes(g *echo.Group) {
	g.GET("/auth/totp/setup", h.ShowSetup)
}

func (h *APIHandler) RegisterPublicAPIRoutes(g *echo.Group) {
	g.POST("/login", h.Login)
	g.POST("/refresh", h.RefreshToken)
	g.POST("/totp/verify", h.VerifyTOTP)
}

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group, requireAPIKeyDenied echo.MiddlewareFunc) {
	g.GET("/profile", h.Profile)
	g.POST("/auth/logout", h.Logout, requireAPIKeyDenied)

	g.GET("/totp/setup", h.GetTOTPSetup, requireAPIKeyDenied)
	g.POST("/totp/enable", h.EnableTOTP, requireAPIKeyDenied)
	g.POST("/totp/disable", h.DisableTOTP, requireAPIKeyDenied)
	g.GET("/totp/status", h.GetTOTPStatus, requireAPIKeyDenied)

	g.POST("/sessions", h.GetSessions, requireAPIKeyDenied)
	g.POST("/sessions/revoke", h.RevokeSession, requireAPIKeyDenied)
	g.POST("/sessions/revoke-all-others", h.RevokeAllOtherSessions, requireAPIKeyDenied)
}
