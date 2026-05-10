package server

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAdminWebRoutes(g *echo.Group) {
	g.GET("/servers", h.Index)
}

func (h *UserAPIHandler) RegisterProtectedAPIRoutes(g *echo.Group, requireUserScope echo.MiddlewareFunc) {
	g.GET("/servers", h.ListServers, requireUserScope)
	g.GET("/servers/:serverid", h.GetServer, requireUserScope)
	g.GET("/servers/:serverid/statistics", h.GetServerStatistics, requireUserScope)
}

func (h *APIHandler) RegisterAdminAPIRoutes(g *echo.Group, requireAdminRead, requireAdminWrite echo.MiddlewareFunc) {
	g.GET("/servers", h.ListServers, requireAdminRead)
	g.GET("/servers/:id", h.GetServer, requireAdminRead)
	g.POST("/servers", h.CreateServer, requireAdminWrite)
	g.PUT("/servers/:id", h.UpdateServer, requireAdminWrite)
	g.DELETE("/servers/:id", h.DeleteServer, requireAdminWrite)
	g.POST("/servers/:id/test", h.TestConnection, requireAdminWrite)
}
