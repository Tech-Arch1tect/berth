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
	"berth/internal/registry"
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
}
