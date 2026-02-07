package seeds

import (
	"berth/internal/rbac"
	"berth/models"

	"gorm.io/gorm"
)

func SeedRBACData(db *gorm.DB) error {
	permissions := []models.Permission{
		// stack/server-level permissions
		{Name: rbac.PermStacksRead, Resource: "stacks", Action: "read", Description: "View stacks and containers", IsAPIKeyOnly: false},
		{Name: rbac.PermStacksManage, Resource: "stacks", Action: "manage", Description: "Start/stop/deploy/remove stacks", IsAPIKeyOnly: false},
		{Name: rbac.PermStacksCreate, Resource: "stacks", Action: "create", Description: "Create new stacks", IsAPIKeyOnly: false},
		{Name: rbac.PermFilesRead, Resource: "files", Action: "read", Description: "Read files within stacks", IsAPIKeyOnly: false},
		{Name: rbac.PermFilesWrite, Resource: "files", Action: "write", Description: "Modify files within stacks", IsAPIKeyOnly: false},
		{Name: rbac.PermLogsRead, Resource: "logs", Action: "read", Description: "View container logs", IsAPIKeyOnly: false},
		{Name: rbac.PermDockerMaintenanceRead, Resource: "docker", Action: "maintenance.read", Description: "View Docker usage statistics and system information (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: rbac.PermDockerMaintenanceWrite, Resource: "docker", Action: "maintenance.write", Description: "Run Docker maintenance tasks like pruning images and containers (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: rbac.PermRegistriesManage, Resource: "registries", Action: "manage", Description: "Create, update, and delete registry credentials", IsAPIKeyOnly: false},

		// admin permissions for API key scope enforcement
		{Name: rbac.PermAdminUsersRead, Resource: "admin.users", Action: "read", Description: "View users and their roles", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminUsersWrite, Resource: "admin.users", Action: "write", Description: "Create users, assign/revoke roles", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminRolesRead, Resource: "admin.roles", Action: "read", Description: "View roles and permissions", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminRolesWrite, Resource: "admin.roles", Action: "write", Description: "Create/modify/delete roles and permissions", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminPermissionsRead, Resource: "admin.permissions", Action: "read", Description: "List available permissions", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminServersRead, Resource: "admin.servers", Action: "read", Description: "View server configurations", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminServersWrite, Resource: "admin.servers", Action: "write", Description: "Create/modify/delete servers", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminLogsRead, Resource: "admin.logs", Action: "read", Description: "View all operation logs", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminAuditRead, Resource: "admin.audit", Action: "read", Description: "View security audit logs", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminSystemExport, Resource: "admin.system", Action: "export", Description: "Export system configuration", IsAPIKeyOnly: true},
		{Name: rbac.PermAdminSystemImport, Resource: "admin.system", Action: "import", Description: "Import system configuration", IsAPIKeyOnly: true},

		// user-level permissions for API key scope enforcement
		{Name: rbac.PermServersRead, Resource: "servers", Action: "read", Description: "View accessible servers", IsAPIKeyOnly: true},
		{Name: rbac.PermLogsOperationsRead, Resource: "logs.operations", Action: "read", Description: "View own operation logs", IsAPIKeyOnly: true},
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
			{Name: rbac.RoleAdmin, Description: "System administrator with full access", IsAdmin: true},
			{Name: rbac.RoleUser, Description: "Standard user with basic permissions", IsAdmin: false},
			{Name: rbac.RoleDeveloper, Description: "Developer with full server access", IsAdmin: false},
			{Name: rbac.RoleViewer, Description: "Read-only access to servers", IsAdmin: false},
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
	if err := db.Where("name = ?", rbac.RoleDeveloper).First(&developerRole).Error; err != nil {
		return nil
	}

	var viewerRole models.Role
	if err := db.Where("name = ?", rbac.RoleViewer).First(&viewerRole).Error; err != nil {
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
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap[rbac.PermStacksRead], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap[rbac.PermStacksManage], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap[rbac.PermFilesRead], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap[rbac.PermFilesWrite], StackPattern: "*"},
			{ServerID: server.ID, RoleID: developerRole.ID, PermissionID: permissionMap[rbac.PermLogsRead], StackPattern: "*"},
		}

		viewerPermissions := []models.ServerRoleStackPermission{
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap[rbac.PermStacksRead], StackPattern: "*"},
			{ServerID: server.ID, RoleID: viewerRole.ID, PermissionID: permissionMap[rbac.PermLogsRead], StackPattern: "*"},
		}

		allPermissions := append(developerPermissions, viewerPermissions...)

		if err := db.Create(&allPermissions).Error; err != nil {
			return err
		}
	}

	return nil
}
