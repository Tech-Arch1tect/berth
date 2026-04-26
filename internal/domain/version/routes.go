package version

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAPIRoutes(g *echo.Group) {
	g.GET("/version", h.GetVersion)
}
