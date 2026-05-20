package rbac

import "berth/internal/domain/rbac/permnames"

const (
	RoleAdmin     = "admin"
	RoleUser      = "user"
	RoleDeveloper = "developer"
	RoleViewer    = "viewer"
)

func AdminStackPermissions() []string {
	return []string{
		permnames.StacksRead,
		permnames.StacksManage,
		permnames.StacksCreate,
		permnames.FilesRead,
		permnames.FilesWrite,
		permnames.LogsRead,
	}
}
