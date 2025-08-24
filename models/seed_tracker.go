package models

type SeedTracker struct {
	BaseModel
	Name string `gorm:"unique;not null" json:"name"`
}
