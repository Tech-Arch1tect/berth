package maintenance

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedWebRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/maintenance", h.ShowMaintenance)
}

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/maintenance/permissions", h.CheckPermissions)
	g.GET("/servers/:serverid/maintenance/info", h.GetSystemInfo)
	g.POST("/servers/:serverid/maintenance/prune", h.PruneDocker)
	g.DELETE("/servers/:serverid/maintenance/resource", h.DeleteResource)
}
