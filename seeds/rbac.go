package seeds

import (
	"brx-starter-kit/models"
	"gorm.io/gorm"
)

func SeedRBACData(db *gorm.DB) error {
	roles := []models.Role{
		{Name: "admin", Description: "System administrator with full access", IsAdmin: true},
		{Name: "user", Description: "Standard user with basic permissions", IsAdmin: false},
	}

	for _, role := range roles {
		if err := db.Where("name = ?", role.Name).FirstOrCreate(&role).Error; err != nil {
			return err
		}
	}

	return nil
}
