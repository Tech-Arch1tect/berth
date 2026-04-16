package models

import (
	"time"
)

type RefreshToken struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	UserID     uint      `json:"user_id" gorm:"not null;index"`
	TokenHash  string    `json:"-" gorm:"uniqueIndex;size:255;not null"`
	ExpiresAt  time.Time `json:"expires_at" gorm:"not null;index"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsed   time.Time `json:"last_used"`
	SessionID  uint      `json:"session_id" gorm:"index"`
	DeviceInfo string    `json:"device_info" gorm:"size:500"`
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
