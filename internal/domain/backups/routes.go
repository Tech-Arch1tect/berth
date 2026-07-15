package backups

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/backups", h.ListBackups, authz.Stack(permnames.BackupsRead))
	reg.GET("/servers/:serverid/stacks/:stackname/backups/:backupid", h.GetBackup, authz.Stack(permnames.BackupsRead))
	reg.DELETE("/servers/:serverid/stacks/:stackname/backups/:backupid", h.DeleteBackup, authz.Stack(permnames.BackupsManage))
	reg.GET("/servers/:serverid/stacks/:stackname/backups/:backupid/files", h.ListBackupFiles, authz.StackAll(permnames.BackupsRead, permnames.FilesRead))
	reg.GET("/servers/:serverid/stacks/:stackname/backups/:backupid/download", h.DownloadBackupFiles, authz.StackAll(permnames.BackupsRead, permnames.FilesRead))
}
