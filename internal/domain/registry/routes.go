package registry

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedWebRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/registries", h.ShowRegistries)
}

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/registries", h.ListCredentials)
	g.GET("/servers/:serverid/registries/:id", h.GetCredential)
	g.POST("/servers/:serverid/registries", h.CreateCredential)
	g.PUT("/servers/:serverid/registries/:id", h.UpdateCredential)
	g.DELETE("/servers/:serverid/registries/:id", h.DeleteCredential)
}
