package auth

import "berth/internal/domain/authz"

func (h *APIHandler) RegisterPublicAPIRoutes(reg *authz.Registrar) {
	pub := authz.Public()
	reg.POST("/login", h.Login, pub)
	reg.POST("/refresh", h.RefreshToken, pub)
	reg.POST("/totp/verify", h.VerifyTOTP, pub)
	reg.POST("/password-reset", h.RequestPasswordResetAPI, pub)
	reg.POST("/password-reset/confirm", h.ConfirmPasswordResetAPI, pub)
	reg.POST("/verify-email", h.VerifyEmailAPI, pub)
	reg.POST("/resend-verification", h.ResendVerificationAPI, pub)
}

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	denied := authz.APIKeyDenied()
	reg.GET("/profile", h.Profile, authz.Authenticated())
	reg.POST("/auth/logout", h.Logout, denied)

	reg.GET("/totp/setup", h.GetTOTPSetup, denied)
	reg.POST("/totp/enable", h.EnableTOTP, denied)
	reg.POST("/totp/disable", h.DisableTOTP, denied)
	reg.GET("/totp/status", h.GetTOTPStatus, denied)

	reg.GET("/sessions", h.GetSessions, denied)
	reg.POST("/sessions/revoke", h.RevokeSession, denied)
	reg.POST("/sessions/revoke-all-others", h.RevokeAllOtherSessions, denied)
}
