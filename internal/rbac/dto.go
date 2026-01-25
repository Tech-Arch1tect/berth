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
