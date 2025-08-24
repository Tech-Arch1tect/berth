package models

import (
	"gorm.io/gorm"
)

type Permission struct {
	gorm.Model
	Name        string `json:"name" gorm:"uniqueIndex;not null"`
	Resource    string `json:"resource" gorm:"not null"`
	Action      string `json:"action" gorm:"not null"`
	Description string `json:"description"`
}
