package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Role struct {
	BaseModel
	Name        string `json:"name" gorm:"uniqueIndex;not null"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin" gorm:"default:false"`
	Users       []User `json:"users" gorm:"many2many:user_roles;"`
}

func (r *Role) BeforeDelete(tx *gorm.DB) error {
	if r.DeletedAt.Time.IsZero() {
		timestamp := time.Now().Unix()
		newName := fmt.Sprintf("%s-deleted-%d", r.Name, timestamp)
		return tx.Model(r).Update("name", newName).Error
	}
	return nil
}
