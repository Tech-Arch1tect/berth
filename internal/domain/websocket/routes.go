package websocket

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"

	"github.com/labstack/echo/v4"
)

func (h *Handler) RegisterAPIRoutes(g *echo.Group) {
	g.GET("/stack-status/:server_id", h.HandleFlutterWebSocket)
}

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/terminal", h.HandleFlutterTerminalWebSocket, authz.Stack(permnames.StacksManage))
}

func (h *EventsHandler) RegisterRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/events", h.HandleStackEvents, authz.Stack(permnames.StacksRead))
}
