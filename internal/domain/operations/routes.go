package operations

import (
	"berth/internal/domain/authz"

	"github.com/labstack/echo/v4"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.POST("/servers/:serverid/stacks/:stackname/operations", h.StartOperation, authz.Resolved(operationRequirement))
}

func (h *WebSocketHandler) RegisterWebSocketRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/stacks/:stackname/operations", h.HandleOperationWebSocket)
	g.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", h.HandleOperationWebSocket)
}
