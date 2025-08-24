package models

type Permission struct {
	BaseModel
	Name        string `json:"name" gorm:"uniqueIndex;not null"`
	Resource    string `json:"resource" gorm:"not null"`
	Action      string `json:"action" gorm:"not null"`
	Description string `json:"description"`
}
