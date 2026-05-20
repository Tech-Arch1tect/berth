package stack

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks", h.ListServerStacks, authz.Server(permnames.StacksRead).WithListScope())
	reg.POST("/servers/:serverid/stacks", h.CreateStack, authz.Resolved(createStackRequirement))
	reg.GET("/servers/:serverid/stacks/can-create", h.CheckCanCreateStack, authz.Authenticated())
	reg.GET("/servers/:serverid/stacks/:stackname", h.GetStackDetails, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/permissions", h.CheckPermissions, authz.Authenticated())
	reg.GET("/servers/:serverid/stacks/:stackname/networks", h.GetStackNetworks, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/volumes", h.GetStackVolumes, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/environment", h.GetStackEnvironmentVariables, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/images", h.GetContainerImageDetails, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/compose", h.GetComposeConfig, authz.Stack(permnames.FilesRead))
	reg.PATCH("/servers/:serverid/stacks/:stackname/compose", h.UpdateCompose, authz.Stack(permnames.FilesWrite))
	reg.GET("/servers/:serverid/stacks/:stackname/stats", h.GetStackStats, authz.Stack(permnames.StacksRead))
}
