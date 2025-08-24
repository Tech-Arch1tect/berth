package dto

import (
	"brx-starter-kit/models"
	"time"
)

func FormatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := t.Format(time.RFC3339)
	return &formatted
}

func ConvertUserToUserInfo(user models.User) UserInfo {
	roleInfos := make([]RoleInfo, len(user.Roles))
	for i, role := range user.Roles {
		roleInfos[i] = RoleInfo{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
			IsAdmin:     role.IsAdmin,
		}
	}

	return UserInfo{
		ID:              user.ID,
		Username:        user.Username,
		Email:           user.Email,
		EmailVerifiedAt: FormatTimePtr(user.EmailVerifiedAt),
		TOTPEnabled:     false, // TODO: Check TOTP status from service
		CreatedAt:       user.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       user.UpdatedAt.Format(time.RFC3339),
		Roles:           roleInfos,
	}
}

func ConvertPermissionToPermissionInfo(permission models.Permission) PermissionInfo {
	return PermissionInfo{
		ID:          permission.ID,
		Name:        permission.Name,
		Resource:    permission.Resource,
		Action:      permission.Action,
		Description: permission.Description,
	}
}

func ConvertRoleToRoleWithPermissions(role models.Role) RoleWithPermissions {
	return RoleWithPermissions{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description,
		IsAdmin:     role.IsAdmin,
		Permissions: []PermissionInfo{},
	}
}
