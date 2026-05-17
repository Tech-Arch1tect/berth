package files

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/files", h.ListDirectory, authz.Stack(rbac.PermFilesRead))
	reg.GET("/servers/:serverid/stacks/:stackname/files/read", h.ReadFile, authz.Stack(rbac.PermFilesRead))
	reg.POST("/servers/:serverid/stacks/:stackname/files/write", h.WriteFile, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/upload", h.UploadFile, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/mkdir", h.CreateDirectory, authz.Stack(rbac.PermFilesWrite))
	reg.DELETE("/servers/:serverid/stacks/:stackname/files/delete", h.Delete, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/rename", h.Rename, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/copy", h.Copy, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/chmod", h.Chmod, authz.Stack(rbac.PermFilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/chown", h.Chown, authz.Stack(rbac.PermFilesWrite))
	reg.GET("/servers/:serverid/stacks/:stackname/files/download", h.DownloadFile, authz.Stack(rbac.PermFilesRead))
	reg.GET("/servers/:serverid/stacks/:stackname/files/stats", h.GetDirectoryStats, authz.Stack(rbac.PermFilesRead))
}
