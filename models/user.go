package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type User struct {
	BaseModel
	Username        string     `json:"username" gorm:"uniqueIndex;not null"`
	Email           string     `json:"email" gorm:"uniqueIndex;not null"`
	Password        string     `json:"-" gorm:"not null"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty" gorm:""`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty" gorm:""`
	Roles           []Role     `json:"roles,omitempty" gorm:"many2many:user_roles;"`
}

func (u *User) BeforeDelete(tx *gorm.DB) error {
	if u.DeletedAt.Time.IsZero() {
		timestamp := time.Now().Unix()
		return tx.Model(u).Updates(map[string]interface{}{
			"username": fmt.Sprintf("%s-deleted-%d", u.Username, timestamp),
			"email":    fmt.Sprintf("%s-deleted-%d", u.Email, timestamp),
		}).Error
	}
	return nil
}

func (u *User) IsAdmin() bool {
	for _, role := range u.Roles {
		if role.IsAdmin {
			return true
		}
	}
	return false
}
