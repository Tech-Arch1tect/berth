package vulnscan

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedAPIRoutes(g *echo.Group) {
	g.POST("/servers/:serverid/stacks/:stackname/vulnscan", h.StartScan)
	g.GET("/servers/:serverid/stacks/:stackname/vulnscan", h.GetLatestScanForStack)
	g.GET("/servers/:serverid/stacks/:stackname/vulnscan/history", h.GetScansForStack)
	g.GET("/servers/:serverid/stacks/:stackname/vulnscan/trend", h.GetScanTrend)
	g.GET("/vulnscan/:scanid", h.GetScan)
	g.GET("/vulnscan/:scanid/summary", h.GetScanSummary)
	g.GET("/vulnscan/compare/:baseScanId/:compareScanId", h.CompareScans)
}
