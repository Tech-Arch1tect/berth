package apikey

import "berth/internal/domain/authz"

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	rule := authz.APIKeyDenied()
	reg.GET("/api-keys", h.ListAPIKeys, rule)
	reg.GET("/api-keys/:id", h.GetAPIKey, rule)
	reg.POST("/api-keys", h.CreateAPIKey, rule)
	reg.DELETE("/api-keys/:id", h.RevokeAPIKey, rule)
	reg.GET("/api-keys/:id/scopes", h.ListScopes, rule)
	reg.POST("/api-keys/:id/scopes", h.AddScope, rule)
	reg.DELETE("/api-keys/:id/scopes/:scopeId", h.RemoveScope, rule)
}
