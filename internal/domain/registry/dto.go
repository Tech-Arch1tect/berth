package registry

import (
	"errors"
	"time"

	"berth/internal/domain/server"
)

var (
	ErrCredentialFieldsRequired       = errors.New("registry_url, username, and password are required")
	ErrCredentialUpdateFieldsRequired = errors.New("registry_url and username are required")
)

type CreateCredentialRequest struct {
	StackPattern string `json:"stack_pattern,omitempty"`
	RegistryURL  string `json:"registry_url"`
	ImagePattern string `json:"image_pattern,omitempty"`
	Username     string `json:"username"`
	Password     string `json:"password"`
}

func (r *CreateCredentialRequest) Validate() error {
	if r.RegistryURL == "" || r.Username == "" || r.Password == "" {
		return ErrCredentialFieldsRequired
	}
	return nil
}

type UpdateCredentialRequest struct {
	StackPattern string `json:"stack_pattern,omitempty"`
	RegistryURL  string `json:"registry_url"`
	ImagePattern string `json:"image_pattern,omitempty"`
	Username     string `json:"username"`
	Password     string `json:"password,omitempty"`
}

func (r *UpdateCredentialRequest) Validate() error {
	if r.RegistryURL == "" || r.Username == "" {
		return ErrCredentialUpdateFieldsRequired
	}
	return nil
}

type RegistryCredentialInfo struct {
	ID           uint      `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ServerID     uint      `json:"server_id"`
	StackPattern string    `json:"stack_pattern"`
	RegistryURL  string    `json:"registry_url"`
	ImagePattern string    `json:"image_pattern,omitempty"`
	Username     string    `json:"username"`
}

type ListCredentialsData struct {
	Credentials []RegistryCredentialInfo `json:"credentials"`
}

type GetCredentialData struct {
	Credential RegistryCredentialInfo `json:"credential"`
}

type DeleteCredentialMessageData struct {
	Message string `json:"message"`
}

func ToResponse(cred *server.ServerRegistryCredential) RegistryCredentialInfo {
	return RegistryCredentialInfo{
		ID:           cred.ID,
		CreatedAt:    cred.CreatedAt,
		UpdatedAt:    cred.UpdatedAt,
		ServerID:     cred.ServerID,
		StackPattern: cred.StackPattern,
		RegistryURL:  cred.RegistryURL,
		ImagePattern: cred.ImagePattern,
		Username:     cred.Username,
	}
}

func ToResponseList(creds []server.ServerRegistryCredential) []RegistryCredentialInfo {
	result := make([]RegistryCredentialInfo, len(creds))
	for i, cred := range creds {
		result[i] = ToResponse(&cred)
	}
	return result
}
