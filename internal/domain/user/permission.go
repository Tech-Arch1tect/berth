package user

import "berth/internal/platform/db"

type Permission struct {
	db.BaseModel
	Name         string `json:"name" gorm:"uniqueIndex;not null"`
	Resource     string `json:"resource" gorm:"not null"`
	Action       string `json:"action" gorm:"not null"`
	Description  string `json:"description"`
	IsAPIKeyOnly bool   `json:"is_api_key_only" gorm:"default:false;not null"`
}
