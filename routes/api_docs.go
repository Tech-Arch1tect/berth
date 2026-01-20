package routes

import (
	"net/http"

	"berth/internal/config"
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
}
