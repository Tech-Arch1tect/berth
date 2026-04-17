package models

import (
	"time"

	"gorm.io/gorm"
)

type EmailVerificationToken struct {
	gorm.Model
	Email     string     `json:"email" gorm:"index;not null"`
	Token     string     `json:"-" gorm:"uniqueIndex;not null"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null"`
	Used      bool       `json:"used" gorm:"default:false"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
}

func (EmailVerificationToken) TableName() string {
	return "email_verification_tokens"
}
