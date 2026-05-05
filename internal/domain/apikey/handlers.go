package apikey

import (
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"strconv"
	"time"

	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
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
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	apiKeys, err := h.service.ListAPIKeys(userID)
	if err != nil {
		return response.Internal(c, "Failed to retrieve API keys")
	}

	responses := make([]APIKeyInfo, len(apiKeys))
	for i, key := range apiKeys {
		responses[i] = key.ToResponse()
	}

	return response.OK(c, responses)
}

func (h *Handler) GetAPIKey(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return response.BadRequest(c, "Invalid API key ID")
	}

	apiKey, err := h.service.GetAPIKey(uint(apiKeyID), userID)
	if err != nil {
		return response.NotFound(c, "API key not found")
	}

	return response.OK(c, apiKey.ToResponse())
}

func (h *Handler) CreateAPIKey(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	var req CreateAPIKeyRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		parsedTime, err := time.Parse("2006-01-02T15:04:05Z07:00", *req.ExpiresAt)
		if err != nil {
			return response.BadRequest(c, "Invalid expiration date format")
		}
		expiresAt = &parsedTime
	}

	plainKey, apiKey, err := h.service.GenerateAPIKey(userID, req.Name, expiresAt)
	if err != nil {
		return response.Internal(c, "Failed to create API key")
	}

	user, _ := session.LoadCurrentUser(c, h.db)
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

	return response.Created(c, CreateAPIKeyData{
		Message:  "API key created successfully. Save this key securely - it won't be shown again!",
		APIKey:   apiKey.ToResponse(),
		PlainKey: plainKey,
	})
}

func (h *Handler) RevokeAPIKey(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return response.BadRequest(c, "Invalid API key ID")
	}

	apiKey, _ := h.service.GetAPIKey(uint(apiKeyID), userID)
	apiKeyName := ""
	if apiKey != nil {
		apiKeyName = apiKey.Name
	}

	err = h.service.RevokeAPIKey(uint(apiKeyID), userID)
	if err != nil {
		return response.NotFound(c, "API key not found")
	}

	user, _ := session.LoadCurrentUser(c, h.db)
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

	return response.OK(c, MessageData{Message: "API key revoked successfully"})
}

func (h *Handler) ListScopes(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return response.BadRequest(c, "Invalid API key ID")
	}

	scopes, err := h.service.ListScopes(uint(apiKeyID), userID)
	if err != nil {
		return response.NotFound(c, "API key not found")
	}

	responses := make([]APIKeyScopeInfo, len(scopes))
	for i, scope := range scopes {
		responses[i] = scope.ToResponse()
	}

	return response.OK(c, responses)
}

func (h *Handler) AddScope(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	apiKeyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return response.BadRequest(c, "Invalid API key ID")
	}

	var req AddScopeRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	ctx := c.Request().Context()
	err = h.service.AddScope(ctx, uint(apiKeyID), userID, req.ServerID, req.StackPattern, req.Permission)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	user, _ := session.LoadCurrentUser(c, h.db)
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

	return response.Created(c, MessageData{Message: "Scope added successfully"})
}

func (h *Handler) RemoveScope(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}

	scopeID, err := strconv.ParseUint(c.Param("scopeId"), 10, 32)
	if err != nil {
		return response.BadRequest(c, "Invalid scope ID")
	}

	apiKeyID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	err = h.service.RemoveScope(uint(scopeID), userID)
	if err != nil {
		return response.NotFound(c, "Scope not found")
	}

	user, _ := session.LoadCurrentUser(c, h.db)
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

	return response.OK(c, MessageData{Message: "Scope removed successfully"})
}
