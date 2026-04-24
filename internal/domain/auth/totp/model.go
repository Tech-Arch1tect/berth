package totp

import (
	"gorm.io/gorm"
)

type TOTPSecret struct {
	gorm.Model
	UserID  uint   `json:"user_id" gorm:"uniqueIndex;not null"`
	Secret  string `json:"-" gorm:"not null"`
	Enabled bool   `json:"enabled" gorm:"not null;default:false"`
}

type UsedCode struct {
	gorm.Model
	UserID uint   `gorm:"index:idx_user_code,priority:1;not null"`
	Code   string `gorm:"index:idx_user_code,priority:2;not null"`
	UsedAt int64  `gorm:"index:idx_used_at;not null"`
}
