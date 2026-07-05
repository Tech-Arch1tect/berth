package vulnscan

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.POST("/servers/:serverid/stacks/:stackname/vulnscan", h.StartScan, authz.Stack(permnames.StacksManage))
	reg.GET("/servers/:serverid/stacks/:stackname/vulnscan", h.GetLatestScanForStack, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/vulnscan/history", h.GetScansForStack, authz.Stack(permnames.StacksRead))
	reg.GET("/servers/:serverid/stacks/:stackname/vulnscan/trend", h.GetScanTrend, authz.Stack(permnames.StacksRead))
	reg.GET("/vulnscan/:scanid", h.GetScan, authz.Resolved(scanRequirement(h.service)))
	reg.GET("/vulnscan/:scanid/summary", h.GetScanSummary, authz.Resolved(scanRequirement(h.service)))
	reg.GET("/vulnscan/compare/:baseScanId/:compareScanId", h.CompareScans, authz.Resolved(scanCompareRequirement(h.service)))
}
