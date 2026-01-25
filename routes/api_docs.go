package routes

import (
	"net/http"

	"berth/handlers"
	"berth/internal/apikey"
	"berth/internal/config"
	"berth/internal/dto"
	"berth/internal/files"
	"berth/internal/imageupdates"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/stack"
	"berth/internal/vulnscan"

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

	// Version
	apiDoc.Document("GET", "/api/v1/version").
		Tags("system").
		Summary("Get application version").
		Description("Returns the current version of the Berth application.").
		Response(http.StatusOK, handlers.GetVersionResponse{}, "Application version").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Registry Credentials
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/registries").
		Tags("registries").
		Summary("List registry credentials").
		Description("Returns all registry credentials for a server. Requires registries.manage permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, registry.ListCredentialsResponse{}, "List of registry credentials").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/registries/{id}").
		Tags("registries").
		Summary("Get registry credential").
		Description("Returns a specific registry credential by ID. Requires registries.manage permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("id", "Credential ID").TypeInt().Required().
		Response(http.StatusOK, registry.GetCredentialResponse{}, "Registry credential details").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusNotFound, ErrorResponse{}, "Credential not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/registries").
		Tags("registries").
		Summary("Create registry credential").
		Description("Creates a new registry credential for a server. Requires registries.manage permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Body(registry.CreateCredentialRequest{}, "Registry credential details").
		Response(http.StatusCreated, registry.CreateCredentialResponse{}, "Created registry credential").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("PUT", "/api/v1/servers/{serverid}/registries/{id}").
		Tags("registries").
		Summary("Update registry credential").
		Description("Updates an existing registry credential. Requires registries.manage permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("id", "Credential ID").TypeInt().Required().
		Body(registry.UpdateCredentialRequest{}, "Updated registry credential details").
		Response(http.StatusOK, registry.UpdateCredentialResponse{}, "Updated registry credential").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusNotFound, ErrorResponse{}, "Credential not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/servers/{serverid}/registries/{id}").
		Tags("registries").
		Summary("Delete registry credential").
		Description("Deletes a registry credential. Requires registries.manage permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("id", "Credential ID").TypeInt().Required().
		Response(http.StatusOK, registry.DeleteCredentialResponse{}, "Credential deleted successfully").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusNotFound, ErrorResponse{}, "Credential not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

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

	// Compose Editor
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/compose").
		Tags("stacks", "compose").
		Summary("Get compose configuration").
		Description("Returns the parsed Docker Compose configuration for a stack. Requires files.read permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, stack.RawComposeConfig{}, "Compose configuration").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("PATCH", "/api/v1/servers/{serverid}/stacks/{stackname}/compose").
		Tags("stacks", "compose").
		Summary("Update compose configuration").
		Description("Updates the Docker Compose configuration with the specified changes. Supports preview mode to see changes without applying. Requires files.write permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(stack.UpdateComposeRequest{}, "Changes to apply to the compose file").
		Response(http.StatusOK, stack.UpdateComposeResponse{}, "Update result with original and modified YAML").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request body").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Vulnerability Scanning
	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/vulnscan").
		Tags("vulnscan").
		Summary("Start vulnerability scan").
		Description("Starts a vulnerability scan for a stack. Requires stacks.read permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(vulnscan.StartScanRequest{}, "Optional list of services to scan").
		Response(http.StatusOK, vulnscan.StartScanResponse{}, "Scan started").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/vulnscan").
		Tags("vulnscan").
		Summary("Get latest scan for stack").
		Description("Returns the most recent vulnerability scan and summary for a stack. Requires stacks.read permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, vulnscan.GetLatestScanResponse{}, "Latest scan with summary").
		Response(http.StatusNotFound, ErrorResponse{}, "No scans found for stack").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/vulnscan/history").
		Tags("vulnscan").
		Summary("Get scan history for stack").
		Description("Returns all vulnerability scans for a stack with summaries. Requires stacks.read permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, vulnscan.GetScansHistoryResponse{}, "Scan history with summaries").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/vulnscan/trend").
		Tags("vulnscan").
		Summary("Get scan trend for stack").
		Description("Returns vulnerability trend data for a stack. Requires stacks.read permission.").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("limit", "Maximum number of scans to include (default 10, max 50)").TypeInt().
		Response(http.StatusOK, vulnscan.GetScanTrendResponse{}, "Scan trend data").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/vulnscan/{scanid}").
		Tags("vulnscan").
		Summary("Get scan by ID").
		Description("Returns a specific vulnerability scan with all vulnerabilities. Requires stacks.read permission for the scanned stack.").
		PathParam("scanid", "Scan ID").TypeInt().Required().
		Response(http.StatusOK, vulnscan.GetScanResponse{}, "Scan details with vulnerabilities").
		Response(http.StatusNotFound, ErrorResponse{}, "Scan not found").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/vulnscan/{scanid}/summary").
		Tags("vulnscan").
		Summary("Get scan summary").
		Description("Returns vulnerability counts by severity for a scan. Requires stacks.read permission for the scanned stack.").
		PathParam("scanid", "Scan ID").TypeInt().Required().
		Response(http.StatusOK, vulnscan.GetScanSummaryResponse{}, "Vulnerability summary").
		Response(http.StatusNotFound, ErrorResponse{}, "Scan not found").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Access denied").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/vulnscan/compare/{baseScanId}/{compareScanId}").
		Tags("vulnscan").
		Summary("Compare two scans").
		Description("Compares two vulnerability scans and returns new, fixed, and unchanged vulnerabilities. Both scans must be from the same stack. Requires stacks.read permission.").
		PathParam("baseScanId", "Base scan ID").TypeInt().Required().
		PathParam("compareScanId", "Comparison scan ID").TypeInt().Required().
		Response(http.StatusOK, vulnscan.CompareScanResponse{}, "Scan comparison").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid scan ID").
		Response(http.StatusNotFound, ErrorResponse{}, "Scan not found").
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

	// Maintenance
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/maintenance/permissions").
		Tags("maintenance").
		Summary("Check maintenance permissions").
		Description("Returns the user's read and write permissions for Docker maintenance operations on the server").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, maintenance.PermissionsResponse{}, "Maintenance permissions").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/maintenance/info").
		Tags("maintenance").
		Summary("Get Docker system information").
		Description("Returns detailed Docker system information including disk usage, images, containers, volumes, networks, and build cache").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Response(http.StatusOK, maintenance.MaintenanceInfo{}, "Docker system information").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/maintenance/prune").
		Tags("maintenance").
		Summary("Prune Docker resources").
		Description("Removes unused Docker resources such as images, containers, volumes, networks, or build cache").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Body(maintenance.PruneRequest{}, "Prune request specifying the resource type to prune").
		Response(http.StatusOK, maintenance.PruneResult{}, "Prune operation result").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid prune type").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/servers/{serverid}/maintenance/resource").
		Tags("maintenance").
		Summary("Delete Docker resource").
		Description("Deletes a specific Docker resource (image, container, volume, or network) by ID").
		PathParam("serverid", "Server ID").TypeInt().Required().
		Body(maintenance.DeleteRequest{}, "Delete request specifying the resource type and ID").
		Response(http.StatusOK, maintenance.DeleteResult{}, "Delete operation result").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid resource type or ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Files
	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/files").
		Tags("files").
		Summary("List directory contents").
		Description("Returns the contents of a directory within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("path", "Directory path to list").Optional().
		Response(http.StatusOK, files.DirectoryListing{}, "Directory listing").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/files/read").
		Tags("files").
		Summary("Read file contents").
		Description("Returns the contents of a file within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("path", "File path to read").Required().
		Response(http.StatusOK, files.FileContent{}, "File contents").
		Response(http.StatusBadRequest, ErrorResponse{}, "Path parameter is required").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/write").
		Tags("files").
		Summary("Write file contents").
		Description("Writes content to a file within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.WriteFileRequest{}, "File write request").
		Response(http.StatusOK, files.MessageResponse{}, "File written successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/upload").
		Tags("files").
		Summary("Upload a file").
		Description("Uploads a file to a stack's file system using multipart form data").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Response(http.StatusOK, files.MessageResponse{}, "File uploaded successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "File is required").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/mkdir").
		Tags("files").
		Summary("Create directory").
		Description("Creates a new directory within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.CreateDirectoryRequest{}, "Directory creation request").
		Response(http.StatusOK, files.MessageResponse{}, "Directory created successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/servers/{serverid}/stacks/{stackname}/files/delete").
		Tags("files").
		Summary("Delete file or directory").
		Description("Deletes a file or directory from a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.DeleteRequest{}, "Delete request").
		Response(http.StatusOK, files.MessageResponse{}, "File or directory deleted successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/rename").
		Tags("files").
		Summary("Rename file or directory").
		Description("Renames or moves a file or directory within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.RenameRequest{}, "Rename request").
		Response(http.StatusOK, files.MessageResponse{}, "File or directory renamed successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/copy").
		Tags("files").
		Summary("Copy file or directory").
		Description("Copies a file or directory within a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.CopyRequest{}, "Copy request").
		Response(http.StatusOK, files.MessageResponse{}, "File or directory copied successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/chmod").
		Tags("files").
		Summary("Change file permissions").
		Description("Changes the permissions (mode) of a file or directory").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.ChmodRequest{}, "Chmod request").
		Response(http.StatusOK, files.MessageResponse{}, "Permissions changed successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/servers/{serverid}/stacks/{stackname}/files/chown").
		Tags("files").
		Summary("Change file ownership").
		Description("Changes the owner and/or group of a file or directory").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		Body(files.ChownRequest{}, "Chown request").
		Response(http.StatusOK, files.MessageResponse{}, "Ownership changed successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/files/download").
		Tags("files").
		Summary("Download a file").
		Description("Downloads a file from a stack's file system").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("path", "File path to download").Required().
		QueryParam("filename", "Optional filename for the downloaded file").Optional().
		Response(http.StatusOK, nil, "File content (binary)").
		Response(http.StatusBadRequest, ErrorResponse{}, "Path parameter is required").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/servers/{serverid}/stacks/{stackname}/files/stats").
		Tags("files").
		Summary("Get directory statistics").
		Description("Returns statistics about a directory including most common owner, group, and mode").
		PathParam("serverid", "Server ID").TypeInt().Required().
		PathParam("stackname", "Stack name").Required().
		QueryParam("path", "Directory path").Optional().
		Response(http.StatusOK, files.DirectoryStats{}, "Directory statistics").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Insufficient permissions").
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

	// Admin Security Audit Logs
	apiDoc.Document("GET", "/api/v1/admin/security-audit-logs").
		Tags("admin", "security-audit").
		Summary("List security audit logs").
		Description("Returns paginated list of security audit logs. Requires admin permissions.").
		QueryParam("page", "Page number").TypeInt().Default(1).Min(1).
		QueryParam("per_page", "Number of items per page").TypeInt().Default(50).Min(1).Max(100).
		QueryParam("event_type", "Filter by event type").Optional().
		QueryParam("event_category", "Filter by event category").Optional().
		QueryParam("severity", "Filter by severity").Optional().
		QueryParam("actor_user_id", "Filter by actor user ID").Optional().
		QueryParam("success", "Filter by success status (true/false)").Optional().
		QueryParam("start_date", "Filter by start date (RFC3339 format)").Optional().
		QueryParam("end_date", "Filter by end date (RFC3339 format)").Optional().
		QueryParam("search", "Search in actor username, target name, or event type").Optional().
		Response(http.StatusOK, security.ListLogsAPIResponse{}, "Paginated list of security audit logs").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request parameters").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/admin/security-audit-logs/stats").
		Tags("admin", "security-audit").
		Summary("Get security audit statistics").
		Description("Returns aggregated statistics for security audit logs. Requires admin permissions.").
		Response(http.StatusOK, security.GetStatsAPIResponse{}, "Security audit statistics").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/admin/security-audit-logs/{id}").
		Tags("admin", "security-audit").
		Summary("Get security audit log details").
		Description("Returns detailed information about a specific security audit log. Requires admin permissions.").
		PathParam("id", "Security audit log ID").TypeInt().Required().
		Response(http.StatusOK, security.GetLogAPIResponse{}, "Security audit log details").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid log ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Log not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Admin User Management
	apiDoc.Document("POST", "/api/v1/admin/users").
		Tags("admin", "users").
		Summary("Create a new user").
		Description("Creates a new user account. Requires admin permissions.").
		Body(rbac.CreateUserRequest{}, "User details").
		Response(http.StatusCreated, rbac.CreateUserResponse{}, "User created successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request or user already exists").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/admin/users/assign-role").
		Tags("admin", "users").
		Summary("Assign a role to a user").
		Description("Assigns a role to a user. Requires admin permissions.").
		Body(rbac.AssignRoleRequest{}, "User and role IDs").
		Response(http.StatusOK, rbac.AssignRoleResponse{}, "Role assigned successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/admin/users/revoke-role").
		Tags("admin", "users").
		Summary("Revoke a role from a user").
		Description("Revokes a role from a user. Requires admin permissions.").
		Body(rbac.RevokeRoleRequest{}, "User and role IDs").
		Response(http.StatusOK, rbac.RevokeRoleResponse{}, "Role revoked successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Admin Role Management
	apiDoc.Document("POST", "/api/v1/admin/roles").
		Tags("admin", "roles").
		Summary("Create a new role").
		Description("Creates a new role. Requires admin permissions.").
		Body(rbac.CreateRoleRequest{}, "Role details").
		Response(http.StatusCreated, rbac.CreateRoleResponse{}, "Role created successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("PUT", "/api/v1/admin/roles/{id}").
		Tags("admin", "roles").
		Summary("Update a role").
		Description("Updates an existing role. Requires admin permissions.").
		PathParam("id", "Role ID").TypeInt().Required().
		Body(rbac.UpdateRoleRequest{}, "Role details").
		Response(http.StatusOK, rbac.UpdateRoleResponse{}, "Role updated successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/admin/roles/{id}").
		Tags("admin", "roles").
		Summary("Delete a role").
		Description("Deletes a role. Requires admin permissions.").
		PathParam("id", "Role ID").TypeInt().Required().
		Response(http.StatusOK, rbac.DeleteRoleResponse{}, "Role deleted successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Role Stack Permissions
	apiDoc.Document("GET", "/api/v1/admin/roles/{roleId}/stack-permissions").
		Tags("admin", "roles").
		Summary("List role stack permissions").
		Description("Returns the role details, available servers, permissions, and current permission rules. Requires admin permissions.").
		PathParam("roleId", "Role ID").TypeInt().Required().
		Response(http.StatusOK, rbac.ListRoleStackPermissionsResponse{}, "Role stack permissions").
		Response(http.StatusBadRequest, ErrorResponse{}, "Cannot manage permissions for admin role").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Role not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/admin/roles/{roleId}/stack-permissions").
		Tags("admin", "roles").
		Summary("Create a role stack permission").
		Description("Creates a new permission rule for a role on a server with a stack pattern. Requires admin permissions.").
		PathParam("roleId", "Role ID").TypeInt().Required().
		Body(rbac.CreateStackPermissionRequest{}, "Permission rule details").
		Response(http.StatusCreated, rbac.CreateStackPermissionResponse{}, "Permission rule created").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request or permission already exists").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/admin/roles/{roleId}/stack-permissions/{permissionId}").
		Tags("admin", "roles").
		Summary("Delete a role stack permission").
		Description("Deletes a permission rule from a role. Requires admin permissions.").
		PathParam("roleId", "Role ID").TypeInt().Required().
		PathParam("permissionId", "Permission rule ID").TypeInt().Required().
		Response(http.StatusOK, rbac.DeleteStackPermissionResponse{}, "Permission rule deleted").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	// Admin Servers
	apiDoc.Document("GET", "/api/v1/admin/servers").
		Tags("admin", "servers").
		Summary("List all servers").
		Description("Returns list of all servers. Requires admin access.").
		Response(http.StatusOK, server.AdminListServersResponse{}, "List of servers").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/admin/servers").
		Tags("admin", "servers").
		Summary("Create a new server").
		Description("Create a new server connection. Requires admin access.").
		Body(server.AdminCreateServerRequest{}, "Server details").
		Response(http.StatusCreated, server.AdminCreateServerResponse{}, "Server created").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("PUT", "/api/v1/admin/servers/{id}").
		Tags("admin", "servers").
		Summary("Update a server").
		Description("Update an existing server connection. Requires admin access.").
		PathParam("id", "Server ID").TypeInt().Required().
		Body(server.AdminUpdateServerRequest{}, "Server details").
		Response(http.StatusOK, server.AdminUpdateServerResponse{}, "Server updated").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Server not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/admin/servers/{id}").
		Tags("admin", "servers").
		Summary("Delete a server").
		Description("Delete a server connection. Requires admin access.").
		PathParam("id", "Server ID").TypeInt().Required().
		Response(http.StatusOK, server.AdminDeleteServerResponse{}, "Server deleted").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Server not found").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "apiKey", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/admin/servers/{id}/test").
		Tags("admin", "servers").
		Summary("Test server connection").
		Description("Test the connection to a server. Requires admin access.").
		PathParam("id", "Server ID").TypeInt().Required().
		Response(http.StatusOK, server.AdminTestConnectionResponse{}, "Connection successful").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusForbidden, ErrorResponse{}, "Admin access required").
		Response(http.StatusNotFound, ErrorResponse{}, "Server not found").
		Response(http.StatusServiceUnavailable, ErrorResponse{}, "Connection test failed").
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

	// API Keys
	apiDoc.Document("GET", "/api/v1/api-keys").
		Tags("api-keys").
		Summary("List API keys").
		Description("Returns all API keys belonging to the authenticated user.").
		Response(http.StatusOK, apikey.ListAPIKeysResponse{}, "List of API keys").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/api-keys/{id}").
		Tags("api-keys").
		Summary("Get API key").
		Description("Returns details of a specific API key.").
		PathParam("id", "API key ID").TypeInt().Required().
		Response(http.StatusOK, apikey.GetAPIKeyResponse{}, "API key details").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid API key ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "API key not found").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/api-keys").
		Tags("api-keys").
		Summary("Create API key").
		Description("Creates a new API key for the authenticated user. The plain key is only returned once at creation time.").
		Body(apikey.CreateAPIKeyRequest{}, "API key creation request").
		Response(http.StatusCreated, apikey.CreateAPIKeyResponse{}, "API key created successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/api-keys/{id}").
		Tags("api-keys").
		Summary("Revoke API key").
		Description("Revokes (deletes) an API key. This action cannot be undone.").
		PathParam("id", "API key ID").TypeInt().Required().
		Response(http.StatusOK, apikey.MessageResponse{}, "API key revoked successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid API key ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "API key not found").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/api-keys/{id}/scopes").
		Tags("api-keys").
		Summary("List API key scopes").
		Description("Returns all scopes configured for a specific API key.").
		PathParam("id", "API key ID").TypeInt().Required().
		Response(http.StatusOK, apikey.ListScopesResponse{}, "List of scopes").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid API key ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "API key not found").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/api-keys/{id}/scopes").
		Tags("api-keys").
		Summary("Add scope to API key").
		Description("Adds a new permission scope to an API key. The scope limits what the API key can access.").
		PathParam("id", "API key ID").TypeInt().Required().
		Body(apikey.AddScopeRequest{}, "Scope details").
		Response(http.StatusCreated, apikey.MessageResponse{}, "Scope added successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "API key not found").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("DELETE", "/api/v1/api-keys/{id}/scopes/{scopeId}").
		Tags("api-keys").
		Summary("Remove scope from API key").
		Description("Removes a permission scope from an API key.").
		PathParam("id", "API key ID").TypeInt().Required().
		PathParam("scopeId", "Scope ID").TypeInt().Required().
		Response(http.StatusOK, apikey.MessageResponse{}, "Scope removed successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid scope ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusNotFound, ErrorResponse{}, "Scope not found").
		Security("bearerAuth", "session").
		Build()

	// TOTP Management
	apiDoc.Document("GET", "/api/v1/totp/status").
		Tags("totp").
		Summary("Get TOTP status").
		Description("Returns whether two-factor authentication is enabled for the authenticated user.").
		Response(http.StatusOK, handlers.TOTPStatusResponse{}, "TOTP status").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("GET", "/api/v1/totp/setup").
		Tags("totp").
		Summary("Get TOTP setup information").
		Description("Returns the QR code URI and secret for setting up two-factor authentication. Only available if TOTP is not already enabled.").
		Response(http.StatusOK, handlers.TOTPSetupResponse{}, "TOTP setup information").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusConflict, ErrorResponse{}, "TOTP already enabled").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/totp/enable").
		Tags("totp").
		Summary("Enable TOTP").
		Description("Enables two-factor authentication after verifying the TOTP code from the authenticator app.").
		Body(handlers.TOTPEnableRequest{}, "TOTP verification code").
		Response(http.StatusOK, handlers.TOTPMessageResponse{}, "TOTP enabled successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid TOTP code").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/totp/disable").
		Tags("totp").
		Summary("Disable TOTP").
		Description("Disables two-factor authentication. Requires both the current TOTP code and password for security.").
		Body(handlers.TOTPDisableRequest{}, "TOTP code and password").
		Response(http.StatusOK, handlers.TOTPMessageResponse{}, "TOTP disabled successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Invalid TOTP code or password").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	// Sessions Management
	apiDoc.Document("POST", "/api/v1/sessions/revoke").
		Tags("sessions").
		Summary("Revoke a session").
		Description("Revokes a specific session by ID. The user will be logged out from that device.").
		Body(handlers.RevokeSessionRequest{}, "Session to revoke").
		Response(http.StatusOK, handlers.SessionMessageResponse{}, "Session revoked successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request or session ID").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()

	apiDoc.Document("POST", "/api/v1/sessions/revoke-all-others").
		Tags("sessions").
		Summary("Revoke all other sessions").
		Description("Revokes all sessions except the current one. For JWT authentication, the refresh token must be provided in the request body.").
		Body(handlers.RevokeAllOtherSessionsRequest{}, "Refresh token (required for JWT auth, not needed for session auth)").
		Response(http.StatusOK, handlers.SessionMessageResponse{}, "All other sessions revoked successfully").
		Response(http.StatusBadRequest, ErrorResponse{}, "Invalid request").
		Response(http.StatusUnauthorized, ErrorResponse{}, "Not authenticated").
		Response(http.StatusInternalServerError, ErrorResponse{}, "Internal server error").
		Security("bearerAuth", "session").
		Build()
}
