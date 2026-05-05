package apikey

import "errors"

const (
	maxAPIKeyNameLength        = 255
	maxScopeStackPatternLength = 255
)

var (
	ErrAPIKeyNameRequired = errors.New("Name is required")
	ErrAPIKeyNameTooLong  = errors.New("Name must be less than 255 characters")

	ErrScopeStackPatternRequired     = errors.New("Stack pattern is required")
	ErrScopeStackPatternTooLong      = errors.New("Stack pattern must be less than 255 characters")
	ErrScopeStackPatternInvalidChars = errors.New("Stack pattern contains invalid characters. Only alphanumeric, dash, underscore, dot, and asterisk are allowed")
	ErrScopePermissionRequired       = errors.New("Permission is required")
)

type CreateAPIKeyRequest struct {
	Name      string  `json:"name"`
	ExpiresAt *string `json:"expires_at,omitempty"`
}

func (r *CreateAPIKeyRequest) Validate() error {
	if r.Name == "" {
		return ErrAPIKeyNameRequired
	}
	if len(r.Name) > maxAPIKeyNameLength {
		return ErrAPIKeyNameTooLong
	}
	return nil
}

type AddScopeRequest struct {
	ServerID     *uint  `json:"server_id,omitempty"`
	StackPattern string `json:"stack_pattern"`
	Permission   string `json:"permission"`
}

func (r *AddScopeRequest) Validate() error {
	if r.StackPattern == "" {
		return ErrScopeStackPatternRequired
	}
	if len(r.StackPattern) > maxScopeStackPatternLength {
		return ErrScopeStackPatternTooLong
	}
	for _, ch := range r.StackPattern {
		if !isValidStackPatternChar(ch) {
			return ErrScopeStackPatternInvalidChars
		}
	}
	if r.Permission == "" {
		return ErrScopePermissionRequired
	}
	return nil
}

func isValidStackPatternChar(r rune) bool {
	switch {
	case r >= 'a' && r <= 'z':
		return true
	case r >= 'A' && r <= 'Z':
		return true
	case r >= '0' && r <= '9':
		return true
	case r == '-', r == '_', r == '.', r == '*':
		return true
	}
	return false
}

type CreateAPIKeyData struct {
	Message  string     `json:"message,omitempty"`
	APIKey   APIKeyInfo `json:"api_key"`
	PlainKey string     `json:"plain_key"`
}

type MessageData struct {
	Message string `json:"message"`
}
