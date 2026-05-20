package operationlogs

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	user := authz.Authenticated().RequireAPIKeyScope(permnames.LogsOperationsRead)
	reg.GET("/operation-logs", h.ListUserOperationLogs, user)
	reg.GET("/operation-logs/stats", h.GetUserOperationLogsStats, user)
	reg.GET("/operation-logs/by-operation-id/:operationId", h.GetOperationLogDetailsByOperationID, user)
	reg.GET("/operation-logs/:id", h.GetUserOperationLogDetails, user)
	reg.GET("/running-operations", h.GetRunningOperations, user)
}

func (h *Handler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	admin := authz.Admin(permnames.AdminLogsRead)
	reg.GET("/operation-logs", h.ListOperationLogs, admin)
	reg.GET("/operation-logs/stats", h.GetOperationLogsStats, admin)
	reg.GET("/operation-logs/:id", h.GetOperationLogDetails, admin)
}
