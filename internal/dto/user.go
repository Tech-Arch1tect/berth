package dto

type RoleInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin"`
}

type PermissionInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
	Description string `json:"description"`
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
	EmailVerifiedAt *string    `json:"email_verified_at"`
	LastLoginAt     *string    `json:"last_login_at"`
	TOTPEnabled     bool       `json:"totp_enabled"`
	CreatedAt       string     `json:"created_at"`
	UpdatedAt       string     `json:"updated_at"`
	Roles           []RoleInfo `json:"roles"`
}
