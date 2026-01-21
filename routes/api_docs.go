package routes

import (
	"net/http"

	"berth/internal/config"
	"berth/internal/dto"
	"berth/internal/server"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/openapi"
)

func RegisterOpenAPIEndpoints(e *echo.Echo, apiDoc *openapi.OpenAPI, cfg *config.BerthConfig) {
	if apiDoc == nil || !cfg.Custom.OpenAPIEnabled {
		return
	}

	e.GET("/openapi.json", apiDoc.JSONHandler())
	e.GET("/openapi.yaml", apiDoc.YAMLHandler())
	e.GET("/docs", apiDoc.SwaggerUIHandler("/openapi.json"))
}

func RegisterAPIDocs(apiDoc *openapi.OpenAPI) {
	if apiDoc == nil {
		return
	}

	apiDoc.Document("GET", "/api/v1/servers").
		Tags("servers").
		Summary("List accessible servers").
		Description("Returns all servers the authenticated user has permission to access").
		Response(http.StatusOK, server.ListServersResponse{}, "List of servers").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/statistics").
		Tags("servers").
		Summary("Get server statistics").
		Description("Returns stack statistics for a specific server").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, server.ServerStatisticsResponse{}, "Server statistics").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid server ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Admin Operation Logs
	apiDoc.Document("GET", "/api/v1/admin/operation-logs").
		Tags("admin", "operation-logs").
		Summary("List all operation logs").
		Description("Returns paginated list of all operation logs. Requires admin permissions.").
		QueryParam("page", "Page number").TypeInt().Default(1).Min(1).
		QueryParam("page_size", "Number of items per page").TypeInt().Default(20).Min(1).Max(100).
		QueryParam("search", "Search term for stack name, command, or operation ID").Optional().
		QueryParam("server_id", "Filter by server ID").Optional().
		QueryParam("stack_name", "Filter by stack name (partial match)").Optional().
		QueryParam("command", "Filter by command").Optional().
		QueryParam("status", "Filter by status").Enum("complete", "incomplete", "failed", "success").Optional().
		QueryParam("days_back", "Only return logs from the last N days").TypeInt().Min(1).Optional().
		Response(http.StatusOK, dto.PaginatedOperationLogs{}, "Paginated list of operation logs").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/admin/operation-logs/stats").
		Tags("admin", "operation-logs").
		Summary("Get operation logs statistics").
		Description("Returns aggregated statistics for all operation logs. Requires admin permissions.").
		Response(http.StatusOK, dto.OperationLogStats{}, "Operation logs statistics").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/admin/operation-logs/{id}").
		Tags("admin", "operation-logs").
		Summary("Get operation log details").
		Description("Returns detailed information about a specific operation log including all messages. Requires admin permissions.").
		PathParam("id", "Operation log ID").TypeInt().Required().
		Response(http.StatusOK, dto.OperationLogDetail{}, "Operation log details with messages").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid operation log ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Operation log not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// User Operation Logs
	apiDoc.Document("GET", "/api/v1/operation-logs").
		Tags("operation-logs").
		Summary("List user's operation logs").
		Description("Returns paginated list of operation logs for the authenticated user.").
		QueryParam("page", "Page number").TypeInt().Default(1).Min(1).
		QueryParam("page_size", "Number of items per page").TypeInt().Default(20).Min(1).Max(100).
		QueryParam("search", "Search term for stack name, command, or operation ID").Optional().
		QueryParam("server_id", "Filter by server ID").Optional().
		QueryParam("stack_name", "Filter by stack name (partial match)").Optional().
		QueryParam("command", "Filter by command").Optional().
		QueryParam("status", "Filter by status").Enum("complete", "incomplete", "failed", "success").Optional().
		QueryParam("days_back", "Only return logs from the last N days").TypeInt().Min(1).Optional().
		Response(http.StatusOK, dto.PaginatedOperationLogs{}, "Paginated list of operation logs").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/operation-logs/stats").
		Tags("operation-logs").
		Summary("Get user's operation logs statistics").
		Description("Returns aggregated statistics for the authenticated user's operation logs.").
		Response(http.StatusOK, dto.OperationLogStats{}, "Operation logs statistics").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/operation-logs/{id}").
		Tags("operation-logs").
		Summary("Get operation log details").
		Description("Returns detailed information about a specific operation log including all messages. Only returns logs belonging to the authenticated user.").
		PathParam("id", "Operation log ID").TypeInt().Required().
		Response(http.StatusOK, dto.OperationLogDetail{}, "Operation log details with messages").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid operation log ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "Operation log not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/operation-logs/by-operation-id/{operationId}").
		Tags("operation-logs").
		Summary("Get operation log details by operation ID").
		Description("Returns detailed information about a specific operation log by its operation ID. Only returns logs belonging to the authenticated user.").
		PathParam("operationId", "Operation ID (UUID)").Required().
		Response(http.StatusOK, dto.OperationLogDetail{}, "Operation log details with messages").
		Response(http.StatusBadRequest, ErrorResponse{}, "Operation ID is required").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "Operation log not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/running-operations").
		Tags("operation-logs").
		Summary("Get running operations").
		Description("Returns list of currently running operations for the authenticated user.").
		Response(http.StatusOK, dto.RunningOperationsResponse{}, "List of running operations").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()
}
