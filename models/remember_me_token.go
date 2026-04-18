package models

import (
	"time"

	"gorm.io/gorm"
)

type RememberMeToken struct {
	gorm.Model
	UserID    uint       `json:"user_id" gorm:"index;not null"`
	Token     string     `json:"-" gorm:"uniqueIndex;not null"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null"`
	Used      bool       `json:"used" gorm:"default:false"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
}
