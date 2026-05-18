package maintenance

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/maintenance/permissions", h.CheckPermissions, authz.Authenticated())
	reg.GET("/servers/:serverid/maintenance/info", h.GetSystemInfo, authz.Server(rbac.PermDockerMaintenanceRead))
	reg.POST("/servers/:serverid/maintenance/prune", h.PruneDocker, authz.Server(rbac.PermDockerMaintenanceWrite))
	reg.DELETE("/servers/:serverid/maintenance/resource", h.DeleteResource, authz.Server(rbac.PermDockerMaintenanceWrite))
}
