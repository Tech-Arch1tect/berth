package rbac

import "berth/internal/domain/user"

type CreateUserRequest struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

type AssignRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

type RevokeRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

type CreateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateStackPermissionRequest struct {
	ServerID     uint   `json:"server_id"`
	PermissionID uint   `json:"permission_id"`
	StackPattern string `json:"stack_pattern"`
}

type MessageData struct {
	Message string `json:"message"`
}

type ServerInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	IsActive    bool   `json:"is_active"`
}

type StackPermissionRule struct {
	ID           uint   `json:"id"`
	ServerID     uint   `json:"server_id"`
	PermissionID uint   `json:"permission_id"`
	StackPattern string `json:"stack_pattern"`
	IsStackBased bool   `json:"is_stack_based"`
}

type ListUsersData struct {
	Users []user.UserInfo `json:"users"`
}

type GetUserRolesData struct {
	User     user.UserInfo   `json:"user"`
	AllRoles []user.RoleInfo `json:"all_roles"`
}

type ListRolesData struct {
	Roles []user.RoleWithPermissions `json:"roles"`
}

type ListRoleStackPermissionsData struct {
	Role            user.RoleInfo         `json:"role"`
	Servers         []ServerInfo          `json:"servers"`
	Permissions     []user.PermissionInfo `json:"permissions"`
	PermissionRules []StackPermissionRule `json:"permissionRules"`
}

type ListPermissionsData struct {
	Permissions []user.PermissionInfo `json:"permissions"`
}
