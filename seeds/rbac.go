package seeds

import (
	"brx-starter-kit/models"
	"gorm.io/gorm"
)

func SeedRBACData(db *gorm.DB) error {
	permissions := []models.Permission{
		{Name: "stacks.read", Resource: "stacks", Action: "read", Description: "View stacks and containers"},
		{Name: "stacks.manage", Resource: "stacks", Action: "manage", Description: "Start/stop/deploy/remove stacks"},
		{Name: "files.read", Resource: "files", Action: "read", Description: "Read files within stacks"},
		{Name: "files.write", Resource: "files", Action: "write", Description: "Modify files within stacks"},
		{Name: "logs.read", Resource: "logs", Action: "read", Description: "View container logs"},
	}

	for _, permission := range permissions {
		if err := db.Where("name = ?", permission.Name).FirstOrCreate(&permission).Error; err != nil {
			return err
		}
	}

	roles := []models.Role{
		{Name: "admin", Description: "System administrator with full access", IsAdmin: true},
		{Name: "user", Description: "Standard user with basic permissions", IsAdmin: false},
		{Name: "developer", Description: "Developer with full server access", IsAdmin: false},
		{Name: "viewer", Description: "Read-only access to servers", IsAdmin: false},
	}

	for _, role := range roles {
		if err := db.Where("name = ?", role.Name).FirstOrCreate(&role).Error; err != nil {
			return err
		}
	}

	return nil
}
