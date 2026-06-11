package user

import "time"

type RoleInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin"`
}

type PermissionInfo struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Resource     string `json:"resource"`
	Action       string `json:"action"`
	Description  string `json:"description"`
	IsAPIKeyOnly bool   `json:"is_api_key_only"`
}

type RoleWithPermissions struct {
	ID          uint             `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	IsAdmin     bool             `json:"is_admin"`
	Permissions []PermissionInfo `json:"permissions"`
}

type UserInfo struct {
	ID              uint       `json:"id"`
	Username        string     `json:"username"`
	Email           string     `json:"email"`
	EmailVerifiedAt *string    `json:"email_verified_at,omitempty"`
	LastLoginAt     *string    `json:"last_login_at,omitempty"`
	TOTPEnabled     bool       `json:"totp_enabled"`
	CreatedAt       string     `json:"created_at"`
	UpdatedAt       string     `json:"updated_at"`
	Roles           []RoleInfo `json:"roles,omitempty"`
}

type UserIdentity struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

func ToUserIdentity(u User) UserIdentity {
	return UserIdentity{
		ID:       u.ID,
		Username: u.Username,
	}
}

func FormatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := t.Format(time.RFC3339)
	return &formatted
}

func ToUserInfo(u User, totpEnabled bool) UserInfo {
	roles := make([]RoleInfo, len(u.Roles))
	for i, r := range u.Roles {
		roles[i] = ToRoleInfo(r)
	}
	return UserInfo{
		ID:              u.ID,
		Username:        u.Username,
		Email:           u.Email,
		EmailVerifiedAt: FormatTimePtr(u.EmailVerifiedAt),
		LastLoginAt:     FormatTimePtr(u.LastLoginAt),
		TOTPEnabled:     totpEnabled,
		CreatedAt:       u.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       u.UpdatedAt.Format(time.RFC3339),
		Roles:           roles,
	}
}

func ToRoleInfo(r Role) RoleInfo {
	return RoleInfo{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		IsAdmin:     r.IsAdmin,
	}
}

func ToPermissionInfo(p Permission) PermissionInfo {
	return PermissionInfo{
		ID:           p.ID,
		Name:         p.Name,
		Resource:     p.Resource,
		Action:       p.Action,
		Description:  p.Description,
		IsAPIKeyOnly: p.IsAPIKeyOnly,
	}
}

func ToRoleWithPermissions(r Role) RoleWithPermissions {
	return RoleWithPermissions{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		IsAdmin:     r.IsAdmin,
		Permissions: []PermissionInfo{},
	}
}
