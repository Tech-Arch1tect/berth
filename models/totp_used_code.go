package models

import (
	"gorm.io/gorm"
)

type UsedCode struct {
	gorm.Model
	UserID uint   `gorm:"index:idx_user_code,priority:1;not null"`
	Code   string `gorm:"index:idx_user_code,priority:2;not null"`
	UsedAt int64  `gorm:"index:idx_used_at;not null"`
}
