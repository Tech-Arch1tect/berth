package rbac

import (
	"berth/internal/domain/rbac/permnames"

	"github.com/labstack/echo/v4"
)

func (h *APIHandler) RegisterAdminAPIRoutes(g *echo.Group, mw *Middleware) {
	g.GET("/users", h.ListUsers, mw.RequireAdminScopeJWT(permnames.AdminUsersRead))
	g.POST("/users", h.CreateUser, mw.RequireAdminScopeJWT(permnames.AdminUsersWrite))
	g.GET("/users/:id/roles", h.GetUserRoles, mw.RequireAdminScopeJWT(permnames.AdminUsersRead))
	g.POST("/users/assign-role", h.AssignRole, mw.RequireAdminScopeJWT(permnames.AdminUsersWrite))
	g.POST("/users/revoke-role", h.RevokeRole, mw.RequireAdminScopeJWT(permnames.AdminUsersWrite))

	g.GET("/roles", h.ListRoles, mw.RequireAdminScopeJWT(permnames.AdminRolesRead))
	g.POST("/roles", h.CreateRole, mw.RequireAdminScopeJWT(permnames.AdminRolesWrite))
	g.PUT("/roles/:id", h.UpdateRole, mw.RequireAdminScopeJWT(permnames.AdminRolesWrite))
	g.DELETE("/roles/:id", h.DeleteRole, mw.RequireAdminScopeJWT(permnames.AdminRolesWrite))
	g.GET("/roles/:roleId/stack-permissions", h.ListRoleServerStackPermissions, mw.RequireAdminScopeJWT(permnames.AdminRolesRead))
	g.POST("/roles/:roleId/stack-permissions", h.CreateRoleStackPermission, mw.RequireAdminScopeJWT(permnames.AdminRolesWrite))
	g.DELETE("/roles/:roleId/stack-permissions/:permissionId", h.DeleteRoleStackPermission, mw.RequireAdminScopeJWT(permnames.AdminRolesWrite))

	g.GET("/permissions", h.ListPermissions, mw.RequireAdminScopeJWT(permnames.AdminPermissionsRead))
}
