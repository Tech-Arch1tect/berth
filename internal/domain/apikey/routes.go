package apikey

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedAPIRoutes(g *echo.Group, requireAPIKeyDenied echo.MiddlewareFunc) {
	g.GET("/api-keys", h.ListAPIKeys, requireAPIKeyDenied)
	g.GET("/api-keys/:id", h.GetAPIKey, requireAPIKeyDenied)
	g.POST("/api-keys", h.CreateAPIKey, requireAPIKeyDenied)
	g.DELETE("/api-keys/:id", h.RevokeAPIKey, requireAPIKeyDenied)
	g.GET("/api-keys/:id/scopes", h.ListScopes, requireAPIKeyDenied)
	g.POST("/api-keys/:id/scopes", h.AddScope, requireAPIKeyDenied)
	g.DELETE("/api-keys/:id/scopes/:scopeId", h.RemoveScope, requireAPIKeyDenied)
}
