package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Username        string     `json:"username" gorm:"uniqueIndex;not null"`
	Email           string     `json:"email" gorm:"uniqueIndex;not null"`
	Password        string     `json:"-" gorm:"not null"`
	EmailVerifiedAt *time.Time `json:"email_verified_at" gorm:""`
	Roles           []Role     `json:"roles" gorm:"many2many:user_roles;"`
}

func (u *User) IsAdmin() bool {
	for _, role := range u.Roles {
		if role.IsAdmin {
			return true
		}
	}
	return false
}

func (u *User) HasServerPermission(db *gorm.DB, serverID uint, permissionName string) bool {
	if u.IsAdmin() {
		return true
	}

	var count int64
	err := db.Table("server_role_permissions").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_permissions.role_id").
		Joins("JOIN permissions ON permissions.id = server_role_permissions.permission_id").
		Where("user_roles.user_id = ? AND server_role_permissions.server_id = ? AND permissions.name = ?", u.ID, serverID, permissionName).
		Count(&count).Error

	if err != nil {
		return false
	}

	return count > 0
}
