package seeds

import (
	"berth/models"

	"gorm.io/gorm"
)

func SeedRBACData(db *gorm.DB) error {
	permissions := []models.Permission{
		// stack/server-level permissions
		{Name: "stacks.read", Resource: "stacks", Action: "read", Description: "View stacks and containers", IsAPIKeyOnly: false},
		{Name: "stacks.manage", Resource: "stacks", Action: "manage", Description: "Start/stop/deploy/remove stacks", IsAPIKeyOnly: false},
		{Name: "files.read", Resource: "files", Action: "read", Description: "Read files within stacks", IsAPIKeyOnly: false},
		{Name: "files.write", Resource: "files", Action: "write", Description: "Modify files within stacks", IsAPIKeyOnly: false},
		{Name: "logs.read", Resource: "logs", Action: "read", Description: "View container logs", IsAPIKeyOnly: false},
		{Name: "docker.maintenance.read", Resource: "docker", Action: "maintenance.read", Description: "View Docker usage statistics and system information (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: "docker.maintenance.write", Resource: "docker", Action: "maintenance.write", Description: "Run Docker maintenance tasks like pruning images and containers (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: "registries.manage", Resource: "registries", Action: "manage", Description: "Create, update, and delete registry credentials", IsAPIKeyOnly: false},

		// admin permissions for API key scope enforcement
		{Name: "admin.users.read", Resource: "admin.users", Action: "read", Description: "View users and their roles", IsAPIKeyOnly: true},
		{Name: "admin.users.write", Resource: "admin.users", Action: "write", Description: "Create users, assign/revoke roles", IsAPIKeyOnly: true},
		{Name: "admin.roles.read", Resource: "admin.roles", Action: "read", Description: "View roles and permissions", IsAPIKeyOnly: true},
		{Name: "admin.roles.write", Resource: "admin.roles", Action: "write", Description: "Create/modify/delete roles and permissions", IsAPIKeyOnly: true},
		{Name: "admin.permissions.read", Resource: "admin.permissions", Action: "read", Description: "List available permissions", IsAPIKeyOnly: true},
		{Name: "admin.servers.read", Resource: "admin.servers", Action: "read", Description: "View server configurations", IsAPIKeyOnly: true},
		{Name: "admin.servers.write", Resource: "admin.servers", Action: "write", Description: "Create/modify/delete servers", IsAPIKeyOnly: true},
		{Name: "admin.logs.read", Resource: "admin.logs", Action: "read", Description: "View all operation logs", IsAPIKeyOnly: true},
		{Name: "admin.audit.read", Resource: "admin.audit", Action: "read", Description: "View security audit logs", IsAPIKeyOnly: true},
		{Name: "admin.system.export", Resource: "admin.system", Action: "export", Description: "Export system configuration", IsAPIKeyOnly: true},
		{Name: "admin.system.import", Resource: "admin.system", Action: "import", Description: "Import system configuration", IsAPIKeyOnly: true},

		// user-level permissions for API key scope enforcement
		{Name: "servers.read", Resource: "servers", Action: "read", Description: "View accessible servers", IsAPIKeyOnly: true},
		{Name: "logs.operations.read", Resource: "logs.operations", Action: "read", Description: "View own operation logs", IsAPIKeyOnly: true},
	}

	for _, permission := range permissions {
		var existingPerm models.Permission
		result := db.Where("name = ?", permission.Name).First(&existingPerm)

		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&permission).Error; err != nil {
				return err
			}
		} else if result.Error != nil {
			return result.Error
		} else {
			existingPerm.Resource = permission.Resource
			existingPerm.Action = permission.Action
			existingPerm.Description = permission.Description
			existingPerm.IsAPIKeyOnly = permission.IsAPIKeyOnly
			if err := db.Save(&existingPerm).Error; err != nil {
				return err
			}
		}
	}

	var seedTracker models.SeedTracker
	result := db.Where("name = ?", "roles_seeded").First(&seedTracker)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		return result.Error
	}

	if result.Error == gorm.ErrRecordNotFound {
		roles := []models.Role{
			{Name: "admin", Description: "System administrator with full access", IsAdmin: true},
			{Name: "user", Description: "Standard user with basic permissions", IsAdmin: false},
			{Name: "developer", Description: "Developer with full server access", IsAdmin: false},
			{Name: "viewer", Description: "Read-only access to servers", IsAdmin: false},
		}

		for _, role := range roles {
			if err := db.Create(&role).Error; err != nil {
				return err
			}
		}

		if err := db.Create(&models.SeedTracker{Name: "roles_seeded"}).Error; err != nil {
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
		if err := db.Model(&models.ServerRoleStackPermission{}).Where("server_id = ?", server.ID).Count(&existingCount).Error; err != nil {
			return err
		}

		if existingCount > 0 {
			continue
		}

		developerPermissions := []models.ServerRoleStackPermission{
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["stacks.read"], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["stacks.manage"], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["files.read"], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["files.write"], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap["logs.read"], StackPattern: "*"},
		}

		viewerPermissions := []models.ServerRoleStackPermission{
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap["stacks.read"], StackPattern: "*"},
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap["logs.read"], StackPattern: "*"},
		}

		allPermissions := append(developerPermissions, viewerPermissions...)

		if err := db.Create(&allPermissions).Error; err != nil {
			return err
		}
	}

	return nil
}
