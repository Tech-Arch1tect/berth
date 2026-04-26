package session

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedWebRoutes(g *echo.Group) {
	g.GET("/sessions", h.Sessions)
}
