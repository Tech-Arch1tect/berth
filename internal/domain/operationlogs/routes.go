package operationlogs

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterProtectedAPIRoutes(g *echo.Group, requireUserScope echo.MiddlewareFunc) {
	g.GET("/operation-logs", h.ListUserOperationLogs, requireUserScope)
	g.GET("/operation-logs/stats", h.GetUserOperationLogsStats, requireUserScope)
	g.GET("/operation-logs/by-operation-id/:operationId", h.GetOperationLogDetailsByOperationID, requireUserScope)
	g.GET("/operation-logs/:id", h.GetUserOperationLogDetails, requireUserScope)
	g.GET("/running-operations", h.GetRunningOperations, requireUserScope)
}

func (h *Handler) RegisterAdminAPIRoutes(g *echo.Group, requireAdminScope echo.MiddlewareFunc) {
	g.GET("/operation-logs", h.ListOperationLogs, requireAdminScope)
	g.GET("/operation-logs/stats", h.GetOperationLogsStats, requireAdminScope)
	g.GET("/operation-logs/:id", h.GetOperationLogDetails, requireAdminScope)
}
