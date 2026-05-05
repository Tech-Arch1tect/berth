package rbac

import (
	"errors"

	"berth/internal/domain/user"
)

var (
	ErrCreateUserFieldsRequired      = errors.New("username, email and password are required")
	ErrCreateUserPasswordMismatch    = errors.New("passwords do not match")
	ErrRoleNameRequired              = errors.New("name is required")
	ErrStackPermissionFieldsRequired = errors.New("server_id and permission_id are required")
	ErrRoleAssignmentFieldsRequired  = errors.New("user_id and role_id are required")
)

type CreateUserRequest struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Username == "" || r.Email == "" || r.Password == "" {
		return ErrCreateUserFieldsRequired
	}
	if r.Password != r.PasswordConfirm {
		return ErrCreateUserPasswordMismatch
	}
	return nil
}

type AssignRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

func (r *AssignRoleRequest) Validate() error {
	if r.UserID == 0 || r.RoleID == 0 {
		return ErrRoleAssignmentFieldsRequired
	}
	return nil
}

type RevokeRoleRequest struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

func (r *RevokeRoleRequest) Validate() error {
	if r.UserID == 0 || r.RoleID == 0 {
		return ErrRoleAssignmentFieldsRequired
	}
	return nil
}

type CreateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (r *CreateRoleRequest) Validate() error {
	if r.Name == "" {
		return ErrRoleNameRequired
	}
	return nil
}

type UpdateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (r *UpdateRoleRequest) Validate() error {
	if r.Name == "" {
		return ErrRoleNameRequired
	}
	return nil
}

type CreateStackPermissionRequest struct {
	ServerID     uint   `json:"server_id"`
	PermissionID uint   `json:"permission_id"`
	StackPattern string `json:"stack_pattern"`
}

func (r *CreateStackPermissionRequest) Validate() error {
	if r.ServerID == 0 || r.PermissionID == 0 {
		return ErrStackPermissionFieldsRequired
	}
	return nil
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
