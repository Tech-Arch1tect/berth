package seeds

import "berth/internal/platform/db"

type SeedTracker struct {
	db.BaseModel
	Name string `gorm:"unique;not null" json:"name"`
}
