package stack

import "github.com/labstack/echo/v4"

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/stacks", h.ListServerStacks)
	g.POST("/servers/:serverid/stacks", h.CreateStack)
	g.GET("/servers/:serverid/stacks/can-create", h.CheckCanCreateStack)
	g.GET("/servers/:serverid/stacks/:stackname", h.GetStackDetails)
	g.GET("/servers/:serverid/stacks/:stackname/permissions", h.CheckPermissions)
	g.GET("/servers/:serverid/stacks/:stackname/networks", h.GetStackNetworks)
	g.GET("/servers/:serverid/stacks/:stackname/volumes", h.GetStackVolumes)
	g.GET("/servers/:serverid/stacks/:stackname/environment", h.GetStackEnvironmentVariables)
	g.GET("/servers/:serverid/stacks/:stackname/images", h.GetContainerImageDetails)
	g.GET("/servers/:serverid/stacks/:stackname/compose", h.GetComposeConfig)
	g.PATCH("/servers/:serverid/stacks/:stackname/compose", h.UpdateCompose)
	g.GET("/servers/:serverid/stacks/:stackname/stats", h.GetStackStats)
}
