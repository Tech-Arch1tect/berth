package operations

import (
	"errors"

	"berth/internal/domain/s3buckets"
)

var ErrOperationCommandRequired = errors.New("command is required")

type OperationRequest struct {
	Command             string               `json:"command"`
	Options             []string             `json:"options"`
	Services            []string             `json:"services"`
	RegistryCredentials []RegistryCredential `json:"registry_credentials,omitempty"`
}

type agentOperationRequest struct {
	OperationRequest
	BackupPassword string                  `json:"backup_password,omitempty"`
	S3Repository   *s3buckets.S3Repository `json:"s3_repository,omitempty"`
}

func (r *OperationRequest) Validate() error {
	if r.Command == "" {
		return ErrOperationCommandRequired
	}
	return nil
}
