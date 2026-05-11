package websocket

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAPIRoutes(g *echo.Group) {
	g.GET("/stack-status/:server_id", h.HandleFlutterWebSocket)
	g.GET("/servers/:serverid/terminal", h.HandleFlutterTerminalWebSocket)
}
