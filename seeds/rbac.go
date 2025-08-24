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

	if err := seedServerPermissions(db); err != nil {
		return err
	}

	return nil
}

func seedServerPermissions(db *gorm.DB) error {
	var serverCount int64
	if err := db.Model(&models.Server{}).Count(&serverCount).Error; err != nil {
		return err
	}

	if serverCount == 0 {
		return nil
	}

	var servers []models.Server
	if err := db.Limit(3).Find(&servers).Error; err != nil {
		return err
	}

	var developerRole models.Role
	if err := db.Where("name = ?", "developer").First(&developerRole).Error; err != nil {
		return nil
	}

	var viewerRole models.Role
	if err := db.Where("name = ?", "viewer").First(&viewerRole).Error; err != nil {
		return nil
	}

	var permissions []models.Permission
	if err := db.Find(&permissions).Error; err != nil {
		return err
	}

	permissionMap := make(map[string]uint)
	for _, permission := range permissions {
		permissionMap[permission.Name] = permission.ID
	}

	for _, server := range servers {
		var existingCount int64
		if err := db.Model(&models.ServerRolePermission{}).Where("server_id = ?", server.ID).Count(&existingCount).Error; err != nil {
			return err
		}

		if existingCount > 0 {
			continue
		}

		developerPermissions := []models.ServerRolePermission{
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["stacks.read"]},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["stacks.manage"]},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["files.read"]},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["files.write"]},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["logs.read"]},
		}

		viewerPermissions := []models.ServerRolePermission{
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap["stacks.read"]},
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap["logs.read"]},
		}

		allPermissions := append(developerPermissions, viewerPermissions...)

		if err := db.Create(&allPermissions).Error; err != nil {
			return err
		}
	}

	return nil
}
