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
}

func (h *StreamHandler) RegisterRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", h.HandleOperationStream, authz.Resolved(h.streamRequirement))
}
