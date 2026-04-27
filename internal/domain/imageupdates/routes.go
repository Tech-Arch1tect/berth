package imageupdates

import "github.com/labstack/echo/v4"

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/image-updates", h.ListAvailableUpdates)
	g.GET("/servers/:serverid/image-updates", h.ListServerUpdates)
}
