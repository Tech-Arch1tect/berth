package security

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *Handler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	rule := authz.Admin(permnames.AdminAuditRead)
	reg.GET("/security-audit-logs", h.ListLogs, rule)
	reg.GET("/security-audit-logs/stats", h.GetStats, rule)
	reg.GET("/security-audit-logs/:id", h.GetLog, rule)
}
