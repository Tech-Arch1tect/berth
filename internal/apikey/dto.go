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
	Success bool                    `json:"success"`
	Data    []models.APIKeyResponse `json:"data"`
}

type GetAPIKeyResponse struct {
	Success bool                  `json:"success"`
	Data    models.APIKeyResponse `json:"data"`
}

type CreateAPIKeyResponseData struct {
	APIKey   models.APIKeyResponse `json:"api_key"`
	PlainKey string                `json:"plain_key"`
}

type CreateAPIKeyResponse struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message,omitempty"`
	Data    CreateAPIKeyResponseData `json:"data"`
}

type ListScopesResponse struct {
	Success bool                         `json:"success"`
	Data    []models.APIKeyScopeResponse `json:"data"`
}

type MessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
