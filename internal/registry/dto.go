package registry

import (
	"berth/models"
	"time"
)

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

type ListCredentialsResponse struct {
	Success bool                `json:"success"`
	Data    ListCredentialsData `json:"data"`
}

type ListCredentialsData struct {
	Credentials []RegistryCredentialInfo `json:"credentials"`
}

type GetCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type GetCredentialData struct {
	Credential RegistryCredentialInfo `json:"credential"`
}

type CreateCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type UpdateCredentialResponse struct {
	Success bool              `json:"success"`
	Data    GetCredentialData `json:"data"`
}

type DeleteCredentialMessageData struct {
	Message string `json:"message"`
}

type DeleteCredentialResponse struct {
	Success bool                        `json:"success"`
	Data    DeleteCredentialMessageData `json:"data"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

func ToResponse(cred *models.ServerRegistryCredential) RegistryCredentialInfo {
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

func ToResponseList(creds []models.ServerRegistryCredential) []RegistryCredentialInfo {
	result := make([]RegistryCredentialInfo, len(creds))
	for i, cred := range creds {
		result[i] = ToResponse(&cred)
	}
	return result
}
