package security

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterAdminAPIRoutes(g *echo.Group, requireAuditRead echo.MiddlewareFunc) {
	g.GET("/security-audit-logs", h.ListLogs, requireAuditRead)
	g.GET("/security-audit-logs/stats", h.GetStats, requireAuditRead)
	g.GET("/security-audit-logs/:id", h.GetLog, requireAuditRead)
}
