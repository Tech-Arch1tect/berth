package files

import "github.com/labstack/echo/v4"

func (h *APIHandler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.GET("/servers/:serverid/stacks/:stackname/files", h.ListDirectory)
	g.GET("/servers/:serverid/stacks/:stackname/files/read", h.ReadFile)
	g.POST("/servers/:serverid/stacks/:stackname/files/write", h.WriteFile)
	g.POST("/servers/:serverid/stacks/:stackname/files/upload", h.UploadFile)
	g.POST("/servers/:serverid/stacks/:stackname/files/mkdir", h.CreateDirectory)
	g.DELETE("/servers/:serverid/stacks/:stackname/files/delete", h.Delete)
	g.POST("/servers/:serverid/stacks/:stackname/files/rename", h.Rename)
	g.POST("/servers/:serverid/stacks/:stackname/files/copy", h.Copy)
	g.POST("/servers/:serverid/stacks/:stackname/files/chmod", h.Chmod)
	g.POST("/servers/:serverid/stacks/:stackname/files/chown", h.Chown)
	g.GET("/servers/:serverid/stacks/:stackname/files/download", h.DownloadFile)
	g.GET("/servers/:serverid/stacks/:stackname/files/stats", h.GetDirectoryStats)
}
