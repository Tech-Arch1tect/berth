package apikey

type CreateAPIKeyRequest struct {
	Name      string  `json:"name"`
	ExpiresAt *string `json:"expires_at,omitempty"`
}

type AddScopeRequest struct {
	ServerID     *uint  `json:"server_id,omitempty"`
	StackPattern string `json:"stack_pattern"`
	Permission   string `json:"permission"`
}

type CreateAPIKeyData struct {
	Message  string     `json:"message,omitempty"`
	APIKey   APIKeyInfo `json:"api_key"`
	PlainKey string     `json:"plain_key"`
}

type MessageData struct {
	Message string `json:"message"`
}
