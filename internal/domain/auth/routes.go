package auth

import "github.com/labstack/echo/v4"

func (h *APIHandler) RegisterPublicAPIRoutes(g *echo.Group) {
	g.POST("/login", h.Login)
	g.POST("/refresh", h.RefreshToken)
	g.POST("/totp/verify", h.VerifyTOTP)
	g.POST("/password-reset", h.RequestPasswordResetAPI)
	g.POST("/password-reset/confirm", h.ConfirmPasswordResetAPI)
	g.POST("/verify-email", h.VerifyEmailAPI)
	g.POST("/resend-verification", h.ResendVerificationAPI)
}

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group, requireAPIKeyDenied echo.MiddlewareFunc) {
	g.GET("/profile", h.Profile)
	g.POST("/auth/logout", h.Logout, requireAPIKeyDenied)

	g.GET("/totp/setup", h.GetTOTPSetup, requireAPIKeyDenied)
	g.POST("/totp/enable", h.EnableTOTP, requireAPIKeyDenied)
	g.POST("/totp/disable", h.DisableTOTP, requireAPIKeyDenied)
	g.GET("/totp/status", h.GetTOTPStatus, requireAPIKeyDenied)

	g.GET("/sessions", h.GetSessions, requireAPIKeyDenied)
	g.POST("/sessions/revoke", h.RevokeSession, requireAPIKeyDenied)
	g.POST("/sessions/revoke-all-others", h.RevokeAllOtherSessions, requireAPIKeyDenied)
}
