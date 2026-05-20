package seeds

import (
	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"
	"berth/internal/domain/user"

	"gorm.io/gorm"
)

func RBACModels() []any {
	return []any{
		&user.User{}, &user.Role{}, &user.Permission{}, &user.ServerRoleStackPermission{},
		&server.Server{},
		&apikey.APIKey{}, &apikey.APIKeyScope{},
		&SeedTracker{},
	}
}

func SeedRBACData(db *gorm.DB) error {
	permissions := []user.Permission{
		// stack/server-level permissions
		{Name: permnames.StacksRead, Resource: "stacks", Action: "read", Description: "View stacks and containers", IsAPIKeyOnly: false},
		{Name: permnames.StacksManage, Resource: "stacks", Action: "manage", Description: "Start/stop/deploy/remove stacks", IsAPIKeyOnly: false},
		{Name: permnames.StacksCreate, Resource: "stacks", Action: "create", Description: "Create new stacks", IsAPIKeyOnly: false},
		{Name: permnames.FilesRead, Resource: "files", Action: "read", Description: "Read files within stacks", IsAPIKeyOnly: false},
		{Name: permnames.FilesWrite, Resource: "files", Action: "write", Description: "Modify files within stacks", IsAPIKeyOnly: false},
		{Name: permnames.LogsRead, Resource: "logs", Action: "read", Description: "View container logs", IsAPIKeyOnly: false},
		{Name: permnames.DockerMaintenanceRead, Resource: "docker", Action: "maintenance.read", Description: "View Docker usage statistics and system information (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: permnames.DockerMaintenanceWrite, Resource: "docker", Action: "maintenance.write", Description: "Run Docker maintenance tasks like pruning images and containers (server-wide, not stack-specific)", IsAPIKeyOnly: false},
		{Name: permnames.RegistriesManage, Resource: "registries", Action: "manage", Description: "Create, update, and delete registry credentials", IsAPIKeyOnly: false},

		// admin permissions for API key scope enforcement
		{Name: permnames.AdminUsersRead, Resource: "admin.users", Action: "read", Description: "View users and their roles", IsAPIKeyOnly: true},
		{Name: permnames.AdminUsersWrite, Resource: "admin.users", Action: "write", Description: "Create users, assign/revoke roles", IsAPIKeyOnly: true},
		{Name: permnames.AdminRolesRead, Resource: "admin.roles", Action: "read", Description: "View roles and permissions", IsAPIKeyOnly: true},
		{Name: permnames.AdminRolesWrite, Resource: "admin.roles", Action: "write", Description: "Create/modify/delete roles and permissions", IsAPIKeyOnly: true},
		{Name: permnames.AdminPermissionsRead, Resource: "admin.permissions", Action: "read", Description: "List available permissions", IsAPIKeyOnly: true},
		{Name: permnames.AdminServersRead, Resource: "admin.servers", Action: "read", Description: "View server configurations", IsAPIKeyOnly: true},
		{Name: permnames.AdminServersWrite, Resource: "admin.servers", Action: "write", Description: "Create/modify/delete servers", IsAPIKeyOnly: true},
		{Name: permnames.AdminLogsRead, Resource: "admin.logs", Action: "read", Description: "View all operation logs", IsAPIKeyOnly: true},
		{Name: permnames.AdminAuditRead, Resource: "admin.audit", Action: "read", Description: "View security audit logs", IsAPIKeyOnly: true},
		{Name: permnames.AdminSystemExport, Resource: "admin.system", Action: "export", Description: "Export system configuration", IsAPIKeyOnly: true},
		{Name: permnames.AdminSystemImport, Resource: "admin.system", Action: "import", Description: "Import system configuration", IsAPIKeyOnly: true},

		// user-level permissions for API key scope enforcement
		{Name: permnames.ServersRead, Resource: "servers", Action: "read", Description: "View accessible servers", IsAPIKeyOnly: true},
		{Name: permnames.LogsOperationsRead, Resource: "logs.operations", Action: "read", Description: "View own operation logs", IsAPIKeyOnly: true},
	}

	for _, permission := range permissions {
		var existingPerm user.Permission
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

	var seedTracker SeedTracker
	result := db.Where("name = ?", "roles_seeded").First(&seedTracker)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		return result.Error
	}

	if result.Error == gorm.ErrRecordNotFound {
		roles := []user.Role{
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

		if err := db.Create(&SeedTracker{Name: "roles_seeded"}).Error; err != nil {
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
	if err := db.Model(&server.Server{}).Count(&serverCount).Error; err != nil {
		return err
	}

	if serverCount == 0 {
		return nil
	}

	var servers []server.Server
	if err := db.Limit(3).Find(&servers).Error; err != nil {
		return err
	}

	var developerRole user.Role
	if err := db.Where("name = ?", rbac.RoleDeveloper).First(&developerRole).Error; err != nil {
		return nil
	}

	var viewerRole user.Role
	if err := db.Where("name = ?", rbac.RoleViewer).First(&viewerRole).Error; err != nil {
		return nil
	}

	var permissions []user.Permission
	if err := db.Find(&permissions).Error; err != nil {
		return err
	}

	permissionMap := make(map[string]uint)
	for _, permission := range permissions {
		permissionMap[permission.Name] = permission.ID
	}

	for _, srv := range servers {
		var existingCount int64
		if err := db.Model(&user.ServerRoleStackPermission{}).Where("server_id = ?", srv.ID).Count(&existingCount).Error; err != nil {
			return err
		}

		if existingCount > 0 {
			continue
		}

		developerPermissions := []user.ServerRoleStackPermission{
			{ServerID: srv.ID, RoleID: developerRole.ID, PermissionID: permissionMap[permnames.StacksRead], StackPattern: "*"},
			{ServerID: srv.ID, RoleID: developerRole.ID, PermissionID: permissionMap[permnames.StacksManage], StackPattern: "*"},
			{ServerID: srv.ID, RoleID: developerRole.ID, PermissionID: permissionMap[permnames.FilesRead], StackPattern: "*"},
			{ServerID: srv.ID, RoleID: developerRole.ID, PermissionID: permissionMap[permnames.FilesWrite], StackPattern: "*"},
			{ServerID: srv.ID, RoleID: developerRole.ID, PermissionID: permissionMap[permnames.LogsRead], StackPattern: "*"},
		}

		viewerPermissions := []user.ServerRoleStackPermission{
			{ServerID: srv.ID, RoleID: viewerRole.ID, PermissionID: permissionMap[permnames.StacksRead], StackPattern: "*"},
			{ServerID: srv.ID, RoleID: viewerRole.ID, PermissionID: permissionMap[permnames.LogsRead], StackPattern: "*"},
		}

		allPermissions := append(developerPermissions, viewerPermissions...)

		if err := db.Create(&allPermissions).Error; err != nil {
			return err
		}
	}

	return nil
}
