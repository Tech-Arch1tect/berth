package rbac

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	reg.GET("/users", h.ListUsers, authz.Admin(permnames.AdminUsersRead))
	reg.POST("/users", h.CreateUser, authz.Admin(permnames.AdminUsersWrite))
	reg.GET("/users/:id/roles", h.GetUserRoles, authz.Admin(permnames.AdminUsersRead))
	reg.POST("/users/assign-role", h.AssignRole, authz.Admin(permnames.AdminUsersWrite))
	reg.POST("/users/revoke-role", h.RevokeRole, authz.Admin(permnames.AdminUsersWrite))

	reg.GET("/roles", h.ListRoles, authz.Admin(permnames.AdminRolesRead))
	reg.POST("/roles", h.CreateRole, authz.Admin(permnames.AdminRolesWrite))
	reg.PUT("/roles/:id", h.UpdateRole, authz.Admin(permnames.AdminRolesWrite))
	reg.DELETE("/roles/:id", h.DeleteRole, authz.Admin(permnames.AdminRolesWrite))
	reg.GET("/roles/:roleId/stack-permissions", h.ListRoleServerStackPermissions, authz.Admin(permnames.AdminRolesRead))
	reg.POST("/roles/:roleId/stack-permissions", h.CreateRoleStackPermission, authz.Admin(permnames.AdminRolesWrite))
	reg.DELETE("/roles/:roleId/stack-permissions/:permissionId", h.DeleteRoleStackPermission, authz.Admin(permnames.AdminRolesWrite))

	reg.GET("/permissions", h.ListPermissions, authz.Admin(permnames.AdminPermissionsRead))
}
