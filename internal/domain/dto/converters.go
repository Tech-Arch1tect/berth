package dto

import (
	"time"

	"berth/internal/domain/auth/totp"
	"berth/internal/domain/user"
)

func FormatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := t.Format(time.RFC3339)
	return &formatted
}

func ConvertUserToUserInfo(u user.User, totpSvc *totp.Service) UserInfo {
	roleInfos := make([]RoleInfo, len(u.Roles))
	for i, role := range u.Roles {
		roleInfos[i] = RoleInfo{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
			IsAdmin:     role.IsAdmin,
		}
	}

	return UserInfo{
		ID:              u.ID,
		Username:        u.Username,
		Email:           u.Email,
		EmailVerifiedAt: FormatTimePtr(u.EmailVerifiedAt),
		LastLoginAt:     FormatTimePtr(u.LastLoginAt),
		TOTPEnabled:     totpSvc.IsUserTOTPEnabled(u.ID),
		CreatedAt:       u.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       u.UpdatedAt.Format(time.RFC3339),
		Roles:           roleInfos,
	}
}

func ConvertPermissionToPermissionInfo(permission user.Permission) PermissionInfo {
	return PermissionInfo{
		ID:           permission.ID,
		Name:         permission.Name,
		Resource:     permission.Resource,
		Action:       permission.Action,
		Description:  permission.Description,
		IsAPIKeyOnly: permission.IsAPIKeyOnly,
	}
}

func ConvertRoleToRoleWithPermissions(role user.Role) RoleWithPermissions {
	return RoleWithPermissions{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description,
		IsAdmin:     role.IsAdmin,
		Permissions: []PermissionInfo{},
	}
}
