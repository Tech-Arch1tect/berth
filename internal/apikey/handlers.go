package apikey

import (
	"berth/internal/common"
	"berth/models"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
)

type Handler struct {
	service *Service
	inertia *inertia.Service
}

func NewHandler(service *Service, inertia *inertia.Service) *Handler {
	return &Handler{
		service: service,
		inertia: inertia,
	}
}

func (h *Handler) ShowAPIKeys(c echo.Context) error {
	return h.inertia.Render(c, "APIKeys/Index", map[string]any{
		"title": "API Keys",
	})
}

func (h *Handler) ShowAPIKeyScopes(c echo.Context) error {
	apiKeyID := c.Param("id")
	return h.inertia.Render(c, "APIKeys/Scopes", map[string]any{
		"api_key_id": apiKeyID,
	})
}

func (h *Handler) ListAPIKeys(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	apiKeys, err := h.service.ListAPIKeys(userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusInternalServerError, "Failed to retrieve API keys", err)
	}

	responses := make([]models.APIKeyResponse, len(apiKeys))
	for i, key := range apiKeys {
		responses[i] = key.ToResponse()
	}

	return common.SuccessResponse(c, responses)
}

func (h *Handler) GetAPIKey(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid API key ID", err)
	}

	apiKey, err := h.service.GetAPIKey(uint(apiKeyID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "API key not found", err)
	}

	return common.SuccessResponse(c, apiKey.ToResponse())
}

type CreateAPIKeyRequest struct {
	Name      string  `json:"name"`
	ExpiresAt *string `json:"expires_at"`
}

type CreateAPIKeyResponse struct {
	APIKey   models.APIKeyResponse `json:"api_key"`
	PlainKey string                `json:"plain_key"`
}

func (h *Handler) CreateAPIKey(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	var req CreateAPIKeyRequest
	if err := c.Bind(&req); err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid request", err)
	}

	if req.Name == "" {
		return common.ErrorResponse(c, http.StatusBadRequest, "Name is required", nil)
	}
	if len(req.Name) > 255 {
		return common.ErrorResponse(c, http.StatusBadRequest, "Name must be less than 255 characters", nil)
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		parsedTime, err := time.Parse("2006-01-02T15:04:05Z07:00", *req.ExpiresAt)
		if err != nil {
			return common.ErrorResponse(c, http.StatusBadRequest, "Invalid expiration date format", err)
		}
		expiresAt = &parsedTime
	}

	plainKey, apiKey, err := h.service.GenerateAPIKey(userID, req.Name, expiresAt)
	if err != nil {
		return common.ErrorResponse(c, http.StatusInternalServerError, "Failed to create API key", err)
	}

	return c.JSON(http.StatusCreated, common.Response{
		Success: true,
		Message: "API key created successfully. Save this key securely - it won't be shown again!",
		Data: CreateAPIKeyResponse{
			APIKey:   apiKey.ToResponse(),
			PlainKey: plainKey,
		},
	})
}

func (h *Handler) RevokeAPIKey(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid API key ID", err)
	}

	err = h.service.RevokeAPIKey(uint(apiKeyID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "API key not found", err)
	}

	return c.JSON(http.StatusOK, common.Response{
		Success: true,
		Message: "API key revoked successfully",
	})
}

func (h *Handler) ListScopes(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid API key ID", err)
	}

	scopes, err := h.service.ListScopes(uint(apiKeyID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "API key not found", err)
	}

	responses := make([]models.APIKeyScopeResponse, len(scopes))
	for i, scope := range scopes {
		responses[i] = scope.ToResponse()
	}

	return common.SuccessResponse(c, responses)
}

type AddScopeRequest struct {
	ServerID     *uint  `json:"server_id"`
	StackPattern string `json:"stack_pattern"`
	Permission   string `json:"permission"`
}

func (h *Handler) AddScope(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid API key ID", err)
	}

	var req AddScopeRequest
	if err := c.Bind(&req); err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid request", err)
	}

	if req.StackPattern == "" {
		return common.ErrorResponse(c, http.StatusBadRequest, "Stack pattern is required", nil)
	}
	if len(req.StackPattern) > 255 {
		return common.ErrorResponse(c, http.StatusBadRequest, "Stack pattern must be less than 255 characters", nil)
	}

	for _, r := range req.StackPattern {
		if !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') && !(r >= '0' && r <= '9') &&
			r != '-' && r != '_' && r != '.' && r != '*' {
			return common.ErrorResponse(c, http.StatusBadRequest, "Stack pattern contains invalid characters. Only alphanumeric, dash, underscore, dot, and asterisk are allowed", nil)
		}
	}
	if req.Permission == "" {
		return common.ErrorResponse(c, http.StatusBadRequest, "Permission is required", nil)
	}

	ctx := c.Request().Context()
	err = h.service.AddScope(ctx, uint(apiKeyID), userID, req.ServerID, req.StackPattern, req.Permission)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, err.Error(), err)
	}

	return c.JSON(http.StatusCreated, common.Response{
		Success: true,
		Message: "Scope added successfully",
	})
}

func (h *Handler) RemoveScope(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated", err)
	}

	scopeID, err := strconv.ParseUint(c.Param("scopeId"), 10, 32)
	if err != nil {
		return common.ErrorResponse(c, http.StatusBadRequest, "Invalid scope ID", err)
	}

	err = h.service.RemoveScope(uint(scopeID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "Scope not found", err)
	}

	return c.JSON(http.StatusOK, common.Response{
		Success: true,
		Message: "Scope removed successfully",
	})
}
