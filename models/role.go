package models

import (
	"gorm.io/gorm"
)

type Role struct {
	gorm.Model
	Name        string `json:"name" gorm:"uniqueIndex;not null"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin" gorm:"default:false"`
	Users       []User `json:"users" gorm:"many2many:user_roles;"`
}
