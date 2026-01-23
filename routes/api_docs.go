package routes

import (
	"net/http"

	"berth/internal/config"
	"berth/internal/dto"
	"berth/internal/imageupdates"
	"berth/internal/logs"
	"berth/internal/server"
	"berth/internal/stack"

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

	// Stacks
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks").
		Tags("stacks").
		Summary("List server stacks").
		Description("Returns all stacks on a server that the authenticated user has permission to access").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, stack.ListStacksResponse{}, "List of stacks").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}").
		Tags("stacks").
		Summary("Get stack details").
		Description("Returns detailed information about a specific stack including services and containers").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackDetails{}, "Stack details").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/permissions").
		Tags("stacks").
		Summary("Check stack permissions").
		Description("Returns the list of permissions the authenticated user has for a specific stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackPermissionsResponse{}, "User permissions for the stack").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/networks").
		Tags("stacks").
		Summary("Get stack networks").
		Description("Returns network information for a specific stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackNetworksResponse{}, "Stack networks").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/volumes").
		Tags("stacks").
		Summary("Get stack volumes").
		Description("Returns volume information for a specific stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackVolumesResponse{}, "Stack volumes").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/environment").
		Tags("stacks").
		Summary("Get stack environment variables").
		Description("Returns environment variables for all services in a stack. Use unmask=true to see sensitive values.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("unmask", "Set to true to unmask sensitive values").Optional().
		Response(http.StatusOK, stack.StackEnvironmentResponse{}, "Stack environment variables").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/images").
		Tags("stacks").
		Summary("Get container image details").
		Description("Returns detailed image information for all containers in a stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackImagesResponse{}, "Container image details").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/stats").
		Tags("stacks").
		Summary("Get stack statistics").
		Description("Returns resource usage statistics for all containers in a stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.StackStatsResponse{}, "Stack statistics").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Logs
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/logs").
		Tags("logs").
		Summary("Get stack logs").
		Description("Returns logs for all containers in a stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("tail", "Number of log lines to return").TypeInt().Default(100).Optional().
		QueryParam("since", "Only return logs since this timestamp (RFC3339 format)").Optional().
		QueryParam("timestamps", "Include timestamps in log output").TypeBool().Default(true).Optional().
		Response(http.StatusOK, logs.LogsResponse{}, "Stack logs").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusNotFound, ErrorResponse{}, "Server not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/containers/{containerName}/logs").
		Tags("logs").
		Summary("Get container logs").
		Description("Returns logs for a specific container in a stack").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		PathParam("containerName", "Container name").Required().
		QueryParam("tail", "Number of log lines to return").TypeInt().Default(100).Optional().
		QueryParam("since", "Only return logs since this timestamp (RFC3339 format)").Optional().
		QueryParam("timestamps", "Include timestamps in log output").TypeBool().Default(true).Optional().
		Response(http.StatusOK, logs.LogsResponse{}, "Container logs").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusBadRequest, ErrorResponse{}, "Container name is required").
		Response(http.StatusNotFound, ErrorResponse{}, "Server not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Image Updates
	apiDoc.Document("GET", "/api/v1/image-updates").
		Tags("image-updates").
		Summary("List available image updates").
		Description("Returns all container images with available updates across servers the user can access").
		Response(http.StatusOK, imageupdates.ImageUpdatesResponse{}, "List of available image updates").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/image-updates").
		Tags("image-updates").
		Summary("List server image updates").
		Description("Returns container images with available updates for a specific server").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, imageupdates.ImageUpdatesResponse{}, "List of server image updates").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid server ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/can-create").
		Tags("stacks").
		Summary("Check if user can create stacks").
		Description("Returns whether the authenticated user has permission to create stacks on the server").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, stack.CanCreateStackResponse{}, "Can create response").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks").
		Tags("stacks").
		Summary("Create a new stack").
		Description("Creates a new stack on the server").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Body(stack.CreateStackRequest{}, "Stack creation request").
		Response(http.StatusCreated, stack.CreateStackResponse{}, "Stack created successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Permission denied").
		Response(http.StatusConflict, ErrorResponse{}, "Stack already exists").
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
