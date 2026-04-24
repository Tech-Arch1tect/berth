package user

import (
	"fmt"
	"time"

	"berth/internal/platform/db"

	"gorm.io/gorm"
)

type Role struct {
	db.BaseModel
	Name        string `json:"name" gorm:"uniqueIndex;not null"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin" gorm:"default:false"`
}

func (r *Role) BeforeDelete(tx *gorm.DB) error {
	if r.DeletedAt.Time.IsZero() {
		timestamp := time.Now().Unix()
		newName := fmt.Sprintf("%s-deleted-%d", r.Name, timestamp)
		return tx.Model(r).Update("name", newName).Error
	}
	return nil
}
