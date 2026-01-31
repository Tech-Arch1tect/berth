package apikey

import "berth/models"

type CreateAPIKeyRequest struct {
	Name      string  `json:"name"`
	ExpiresAt *string `json:"expires_at,omitempty"`
}

type AddScopeRequest struct {
	ServerID     *uint  `json:"server_id,omitempty"`
	StackPattern string `json:"stack_pattern"`
	Permission   string `json:"permission"`
}

type ListAPIKeysResponse struct {
	Success bool                `json:"success"`
	Data    []models.APIKeyInfo `json:"data"`
}

type GetAPIKeyResponse struct {
	Success bool              `json:"success"`
	Data    models.APIKeyInfo `json:"data"`
}

type CreateAPIKeyResponseData struct {
	Message  string            `json:"message,omitempty"`
	APIKey   models.APIKeyInfo `json:"api_key"`
	PlainKey string            `json:"plain_key"`
}

type CreateAPIKeyResponse struct {
	Success bool                     `json:"success"`
	Data    CreateAPIKeyResponseData `json:"data"`
}

type ListScopesResponse struct {
	Success bool                     `json:"success"`
	Data    []models.APIKeyScopeInfo `json:"data"`
}

type MessageData struct {
	Message string `json:"message"`
}

type MessageResponse struct {
	Success bool        `json:"success"`
	Data    MessageData `json:"data"`
}
