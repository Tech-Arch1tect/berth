package server

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"

	"github.com/labstack/echo/v4"
)

func (h *UserAPIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers", h.ListServers, authz.Authenticated().WithListScope().RequireAPIKeyScope(permnames.ServersRead))
	reg.GET("/servers/:serverid", h.GetServer, authz.Server(permnames.StacksRead).RequireAPIKeyScope(permnames.ServersRead))
	reg.GET("/servers/:serverid/statistics", h.GetServerStatistics, authz.Server(permnames.StacksRead).RequireAPIKeyScope(permnames.ServersRead))
}

func (h *APIHandler) RegisterAdminAPIRoutes(g *echo.Group, requireAdminRead, requireAdminWrite echo.MiddlewareFunc) {
	g.GET("/servers", h.ListServers, requireAdminRead)
	g.GET("/servers/:id", h.GetServer, requireAdminRead)
	g.POST("/servers", h.CreateServer, requireAdminWrite)
	g.PUT("/servers/:id", h.UpdateServer, requireAdminWrite)
	g.DELETE("/servers/:id", h.DeleteServer, requireAdminWrite)
	g.POST("/servers/:id/test", h.TestConnection, requireAdminWrite)
}
