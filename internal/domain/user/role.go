package user

import (
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
		return tx.Model(r).Update("name", db.TombstoneValue(r.ID, r.Name)).Error
	}
	return nil
}
