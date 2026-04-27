package logs

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/stacks/:stackname/logs", h.GetStackLogs)
	g.GET("/servers/:serverid/stacks/:stackname/containers/:containerName/logs", h.GetContainerLogs)
}
