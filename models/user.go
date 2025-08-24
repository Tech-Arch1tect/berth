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

func (u *User) HasServerPermission(serverID uint, permissionName string) bool {
	if u.IsAdmin() {
		return true
	}
	return false
}
