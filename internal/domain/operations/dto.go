package operations

import "errors"

var ErrOperationCommandRequired = errors.New("command is required")

type OperationRequest struct {
	Command             string               `json:"command"`
	Options             []string             `json:"options"`
	Services            []string             `json:"services"`
	RegistryCredentials []RegistryCredential `json:"registry_credentials,omitempty"`
}

type agentOperationRequest struct {
	OperationRequest
	BackupPassword string `json:"backup_password,omitempty"`
}

func (r *OperationRequest) Validate() error {
	if r.Command == "" {
		return ErrOperationCommandRequired
	}
	return nil
}
