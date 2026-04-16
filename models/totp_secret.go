package models

import (
	"gorm.io/gorm"
)

type TOTPSecret struct {
	gorm.Model
	UserID  uint   `json:"user_id" gorm:"uniqueIndex;not null"`
	Secret  string `json:"-" gorm:"not null"`
	Enabled bool   `json:"enabled" gorm:"not null;default:false"`
}
