package server

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *UserAPIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers", h.ListServers, authz.Authenticated().WithListScope().RequireAPIKeyScope(permnames.ServersRead))
	reg.GET("/servers/:serverid", h.GetServer, authz.Server(permnames.StacksRead).RequireAPIKeyScope(permnames.ServersRead))
	reg.GET("/servers/:serverid/statistics", h.GetServerStatistics, authz.Server(permnames.StacksRead).RequireAPIKeyScope(permnames.ServersRead))
}

func (h *APIHandler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	read := authz.Admin(permnames.AdminServersRead)
	write := authz.Admin(permnames.AdminServersWrite)
	reg.GET("/servers", h.ListServers, read)
	reg.GET("/servers/:id", h.GetServer, read)
	reg.POST("/servers", h.CreateServer, write)
	reg.PUT("/servers/:id", h.UpdateServer, write)
	reg.DELETE("/servers/:id", h.DeleteServer, write)
	reg.POST("/servers/:id/test", h.TestConnection, write)
}
