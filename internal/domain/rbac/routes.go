package rbac

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAdminWebRoutes(g *echo.Group) {
	g.GET("/users", h.ListUsers)
	g.GET("/users/:id/roles", h.ShowUserRoles)
	g.GET("/roles", h.ListRoles)
	g.GET("/roles/:id/stack-permissions", h.RoleServerStackPermissions)
}

func (h *APIHandler) RegisterAdminAPIRoutes(g *echo.Group, mw *Middleware) {
	g.GET("/users", h.ListUsers, mw.RequireAdminScopeJWT(PermAdminUsersRead))
	g.POST("/users", h.CreateUser, mw.RequireAdminScopeJWT(PermAdminUsersWrite))
	g.GET("/users/:id/roles", h.GetUserRoles, mw.RequireAdminScopeJWT(PermAdminUsersRead))
	g.POST("/users/assign-role", h.AssignRole, mw.RequireAdminScopeJWT(PermAdminUsersWrite))
	g.POST("/users/revoke-role", h.RevokeRole, mw.RequireAdminScopeJWT(PermAdminUsersWrite))

	g.GET("/roles", h.ListRoles, mw.RequireAdminScopeJWT(PermAdminRolesRead))
	g.POST("/roles", h.CreateRole, mw.RequireAdminScopeJWT(PermAdminRolesWrite))
	g.PUT("/roles/:id", h.UpdateRole, mw.RequireAdminScopeJWT(PermAdminRolesWrite))
	g.DELETE("/roles/:id", h.DeleteRole, mw.RequireAdminScopeJWT(PermAdminRolesWrite))
	g.GET("/roles/:roleId/stack-permissions", h.ListRoleServerStackPermissions, mw.RequireAdminScopeJWT(PermAdminRolesRead))
	g.POST("/roles/:roleId/stack-permissions", h.CreateRoleStackPermission, mw.RequireAdminScopeJWT(PermAdminRolesWrite))
	g.DELETE("/roles/:roleId/stack-permissions/:permissionId", h.DeleteRoleStackPermission, mw.RequireAdminScopeJWT(PermAdminRolesWrite))

	g.GET("/permissions", h.ListPermissions, mw.RequireAdminScopeJWT(PermAdminPermissionsRead))
}
