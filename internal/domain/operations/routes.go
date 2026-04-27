package operations

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.POST("/servers/:serverid/stacks/:stackname/operations", h.StartOperation)
}

func (h *WebSocketHandler) RegisterWebSocketRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/stacks/:stackname/operations", h.HandleOperationWebSocket)
	g.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", h.HandleOperationWebSocket)
}
