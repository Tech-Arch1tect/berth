package rbac

const (
	PermStacksRead             = "stacks.read"
	PermStacksManage           = "stacks.manage"
	PermStacksCreate           = "stacks.create"
	PermFilesRead              = "files.read"
	PermFilesWrite             = "files.write"
	PermLogsRead               = "logs.read"
	PermDockerMaintenanceRead  = "docker.maintenance.read"
	PermDockerMaintenanceWrite = "docker.maintenance.write"
	PermRegistriesManage       = "registries.manage"
)

const (
	PermAdminUsersRead       = "admin.users.read"
	PermAdminUsersWrite      = "admin.users.write"
	PermAdminRolesRead       = "admin.roles.read"
	PermAdminRolesWrite      = "admin.roles.write"
	PermAdminPermissionsRead = "admin.permissions.read"
	PermAdminServersRead     = "admin.servers.read"
	PermAdminServersWrite    = "admin.servers.write"
	PermAdminLogsRead        = "admin.logs.read"
	PermAdminAuditRead       = "admin.audit.read"
	PermAdminSystemExport    = "admin.system.export"
	PermAdminSystemImport    = "admin.system.import"
)

const (
	PermServersRead        = "servers.read"
	PermLogsOperationsRead = "logs.operations.read"
)

const PermAdminPrefix = "admin."

const (
	RoleAdmin     = "admin"
	RoleUser      = "user"
	RoleDeveloper = "developer"
	RoleViewer    = "viewer"
)

func AdminStackPermissions() []string {
	return []string{PermStacksRead, PermStacksManage, PermStacksCreate, PermFilesRead, PermFilesWrite, PermLogsRead}
}
