package apikey

import (
	"berth/internal/common"
	"berth/internal/security"
	"berth/models"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"gorm.io/gorm"
)

type apikeyAuditLogger interface {
	LogAPIKeyEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID uint, apiKeyName, ip string, metadata map[string]any) error
	LogAPIKeyScopeEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID, scopeID uint, ip string, metadata map[string]any) error
}

type Handler struct {
	service      *Service
	inertia      *inertia.Service
	auditService apikeyAuditLogger
	db           *gorm.DB
}

func NewHandler(service *Service, inertia *inertia.Service, auditService apikeyAuditLogger, db *gorm.DB) *Handler {
	return &Handler{
		service:      service,
		inertia:      inertia,
		auditService: auditService,
		db:           db,
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

	responses := make([]models.APIKeyInfo, len(apiKeys))
	for i, key := range apiKeys {
		responses[i] = key.ToResponse()
	}

	return c.JSON(http.StatusOK, ListAPIKeysResponse{
		Success: true,
		Data:    responses,
	})
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

	return c.JSON(http.StatusOK, GetAPIKeyResponse{
		Success: true,
		Data:    apiKey.ToResponse(),
	})
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

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.LogAPIKeyEvent(
		security.EventAPIKeyCreated,
		userID,
		username,
		apiKey.ID,
		apiKey.Name,
		c.RealIP(),
		map[string]any{
			"key_prefix": apiKey.KeyPrefix,
		},
	)

	return c.JSON(http.StatusCreated, CreateAPIKeyResponse{
		Success: true,
		Data: CreateAPIKeyResponseData{
			Message:  "API key created successfully. Save this key securely - it won't be shown again!",
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

	apiKey, _ := h.service.GetAPIKey(uint(apiKeyID), userID)
	apiKeyName := ""
	if apiKey != nil {
		apiKeyName = apiKey.Name
	}

	err = h.service.RevokeAPIKey(uint(apiKeyID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "API key not found", err)
	}

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.LogAPIKeyEvent(
		security.EventAPIKeyRevoked,
		userID,
		username,
		uint(apiKeyID),
		apiKeyName,
		c.RealIP(),
		nil,
	)

	return c.JSON(http.StatusOK, MessageResponse{
		Success: true,
		Data: MessageData{
			Message: "API key revoked successfully",
		},
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

	responses := make([]models.APIKeyScopeInfo, len(scopes))
	for i, scope := range scopes {
		responses[i] = scope.ToResponse()
	}

	return c.JSON(http.StatusOK, ListScopesResponse{
		Success: true,
		Data:    responses,
	})
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

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.LogAPIKeyScopeEvent(
		security.EventAPIKeyScopeAdded,
		userID,
		username,
		uint(apiKeyID),
		0,
		c.RealIP(),
		map[string]any{
			"server_id":     req.ServerID,
			"stack_pattern": req.StackPattern,
			"permission":    req.Permission,
		},
	)

	return c.JSON(http.StatusCreated, MessageResponse{
		Success: true,
		Data: MessageData{
			Message: "Scope added successfully",
		},
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

	apiKeyID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	err = h.service.RemoveScope(uint(scopeID), userID)
	if err != nil {
		return common.ErrorResponse(c, http.StatusNotFound, "Scope not found", err)
	}

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.LogAPIKeyScopeEvent(
		security.EventAPIKeyScopeRemoved,
		userID,
		username,
		uint(apiKeyID),
		uint(scopeID),
		c.RealIP(),
		nil,
	)

	return c.JSON(http.StatusOK, MessageResponse{
		Success: true,
		Data: MessageData{
			Message: "Scope removed successfully",
		},
	})
}
