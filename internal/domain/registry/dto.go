package registry

import (
	"berth/internal/domain/server"
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
