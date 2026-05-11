package dataexport

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAdminAPIRoutes(g *echo.Group, requireExport, requireImport echo.MiddlewareFunc) {
	g.POST("/migration/export", h.Export, requireExport)
	g.POST("/migration/import", h.Import, requireImport)
}
