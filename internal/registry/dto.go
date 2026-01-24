package registry

import (
	"berth/models"
	"time"
)

type RegistryCredentialResponse struct {
	ID           uint      `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ServerID     uint      `json:"server_id"`
	StackPattern string    `json:"stack_pattern"`
	RegistryURL  string    `json:"registry_url"`
	ImagePattern string    `json:"image_pattern,omitempty"`
	Username     string    `json:"username"`
}

type ListCredentialsResponse struct {
	Success bool                `json:"success"`
	Data    ListCredentialsData `json:"data"`
}

type ListCredentialsData struct {
	Credentials []RegistryCredentialResponse `json:"credentials"`
}

type GetCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type GetCredentialData struct {
	Credential RegistryCredentialResponse `json:"credential"`
}

type CreateCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type UpdateCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type DeleteCredentialResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

func ToResponse(cred *models.ServerRegistryCredential) RegistryCredentialResponse {
	return RegistryCredentialResponse{
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

func ToResponseList(creds []models.ServerRegistryCredential) []RegistryCredentialResponse {
	result := make([]RegistryCredentialResponse, len(creds))
	for i, cred := range creds {
		result[i] = ToResponse(&cred)
	}
	return result
}
