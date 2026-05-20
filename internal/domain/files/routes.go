package files

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/files", h.ListDirectory, authz.Stack(permnames.FilesRead))
	reg.GET("/servers/:serverid/stacks/:stackname/files/read", h.ReadFile, authz.Stack(permnames.FilesRead))
	reg.POST("/servers/:serverid/stacks/:stackname/files/write", h.WriteFile, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/upload", h.UploadFile, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/mkdir", h.CreateDirectory, authz.Stack(permnames.FilesWrite))
	reg.DELETE("/servers/:serverid/stacks/:stackname/files/delete", h.Delete, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/rename", h.Rename, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/copy", h.Copy, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/chmod", h.Chmod, authz.Stack(permnames.FilesWrite))
	reg.POST("/servers/:serverid/stacks/:stackname/files/chown", h.Chown, authz.Stack(permnames.FilesWrite))
	reg.GET("/servers/:serverid/stacks/:stackname/files/download", h.DownloadFile, authz.Stack(permnames.FilesRead))
	reg.GET("/servers/:serverid/stacks/:stackname/files/stats", h.GetDirectoryStats, authz.Stack(permnames.FilesRead))
}
