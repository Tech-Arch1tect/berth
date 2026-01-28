package rbac

import "berth/internal/dto"

type CreateUserRequest struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

type CreateUserResponse struct {
	Success bool         `json:"success"`
	Data    dto.UserInfo `json:"data"`
}

type AssignRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

type AssignRoleResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type RevokeRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

type RevokeRoleResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type CreateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateRoleResponse struct {
	Success bool                    `json:"success"`
	Data    dto.RoleWithPermissions `json:"data"`
}

type UpdateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateRoleResponse struct {
	Success bool                    `json:"success"`
	Data    dto.RoleWithPermissions `json:"data"`
}

type DeleteRoleResponse struct {
	Success bool   `json:"success"`
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

type ListRoleStackPermissionsData struct {
	Role            dto.RoleInfo          `json:"role"`
	Servers         []ServerInfo          `json:"servers"`
	Permissions     []dto.PermissionInfo  `json:"permissions"`
	PermissionRules []StackPermissionRule `json:"permissionRules"`
}

type ListRoleStackPermissionsResponse struct {
	Success bool                         `json:"success"`
	Data    ListRoleStackPermissionsData `json:"data"`
}

type CreateStackPermissionRequest struct {
	ServerID     uint   `json:"server_id"`
	PermissionID uint   `json:"permission_id"`
	StackPattern string `json:"stack_pattern"`
}

type CreateStackPermissionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type DeleteStackPermissionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ListRolesResponseData struct {
	Roles []dto.RoleWithPermissions `json:"roles"`
}

type ListRolesResponse struct {
	Success bool                  `json:"success"`
	Data    ListRolesResponseData `json:"data"`
}
