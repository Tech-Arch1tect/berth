package apikey

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"time"

	"github.com/labstack/echo/v4"
)

type apikeyAuditLogger interface {
	LogAPIKeyEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID uint, apiKeyName, ip string, metadata map[string]any) error
	LogAPIKeyScopeEvent(eventType string, actorUserID uint, actorUsername string, apiKeyID, scopeID uint, ip string, metadata map[string]any) error
}

type Handler struct {
	service      *Service
	auditService apikeyAuditLogger
}

func NewHandler(service *Service, auditService apikeyAuditLogger) *Handler {
	return &Handler{
		service:      service,
		auditService: auditService,
	}
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

	apiKeyID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	apiKey, err := h.service.GetAPIKey(apiKeyID, userID)
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

	username := session.ResolveUsername(c)

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

	apiKeyID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	apiKey, _ := h.service.GetAPIKey(apiKeyID, userID)
	apiKeyName := ""
	if apiKey != nil {
		apiKeyName = apiKey.Name
	}

	err = h.service.RevokeAPIKey(apiKeyID, userID)
	if err != nil {
		return response.NotFound(c, "API key not found")
	}

	username := session.ResolveUsername(c)

	h.auditService.LogAPIKeyEvent(
		security.EventAPIKeyRevoked,
		userID,
		username,
		apiKeyID,
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

	apiKeyID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	scopes, err := h.service.ListScopes(apiKeyID, userID)
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
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return response.Unauthorized(c, "User not authenticated")
	}
	userID := p.UserID()

	apiKeyID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req AddScopeRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	err = h.service.AddScope(p, apiKeyID, req.ServerID, req.StackPattern, req.Permission)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	username := session.ResolveUsername(c)

	h.auditService.LogAPIKeyScopeEvent(
		security.EventAPIKeyScopeAdded,
		userID,
		username,
		apiKeyID,
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

	scopeID, err := echoparams.ParseUintParam(c, "scopeId")
	if err != nil {
		return err
	}

	apiKeyID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	err = h.service.RemoveScope(scopeID, userID)
	if err != nil {
		return response.NotFound(c, "Scope not found")
	}

	username := session.ResolveUsername(c)

	h.auditService.LogAPIKeyScopeEvent(
		security.EventAPIKeyScopeRemoved,
		userID,
		username,
		apiKeyID,
		scopeID,
		c.RealIP(),
		nil,
	)

	return response.OK(c, MessageData{Message: "Scope removed successfully"})
}
