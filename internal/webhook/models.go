package webhook

import (
	"berth/internal/operations"
	"fmt"
	"time"
)

type CreateWebhookRequest struct {
	Name         string     `json:"name" binding:"required"`
	Description  string     `json:"description"`
	StackPattern string     `json:"stack_pattern" binding:"required"`
	ServerScopes []uint     `json:"server_scopes"`
	ExpiresAt    *time.Time `json:"expires_at"`
}

type UpdateWebhookRequest struct {
	Name         *string    `json:"name"`
	Description  *string    `json:"description"`
	StackPattern *string    `json:"stack_pattern"`
	IsActive     *bool      `json:"is_active"`
	ServerScopes *[]uint    `json:"server_scopes"`
	ExpiresAt    *time.Time `json:"expires_at"`
}

type TriggerWebhookRequest struct {
	APIKey     string                    `json:"api_key" binding:"required"`
	ServerID   uint                      `json:"server_id" binding:"required"`
	StackName  string                    `json:"stack_name" binding:"required"`
	Command    string                    `json:"command"`
	Options    []string                  `json:"options"`
	Services   []string                  `json:"services"`
	Operations []TriggerOperationRequest `json:"operations"`
}

type TriggerOperationRequest struct {
	Command  string   `json:"command" binding:"required"`
	Options  []string `json:"options"`
	Services []string `json:"services"`
}

type TriggerWebhookResponse struct {
	BatchID               string                     `json:"batch_id,omitempty"`
	OperationID           string                     `json:"operation_id,omitempty"`
	Operations            []TriggerOperationResponse `json:"operations,omitempty"`
	EstimatedStartTime    *string                    `json:"estimated_start_time,omitempty"`
	EstimatedCompleteTime *string                    `json:"estimated_complete_time,omitempty"`
}

type TriggerOperationResponse struct {
	OperationID     string  `json:"operation_id"`
	Command         string  `json:"command"`
	Status          string  `json:"status"`
	PositionInQueue int     `json:"position_in_queue"`
	Order           int     `json:"order"`
	DependsOn       *string `json:"depends_on,omitempty"`
}

func (req *TriggerWebhookRequest) ToOperationRequest() operations.OperationRequest {
	if req.Command != "" {

		return operations.OperationRequest{
			Command:  req.Command,
			Options:  req.Options,
			Services: req.Services,
		}
	}

	if len(req.Operations) > 0 {
		return operations.OperationRequest{
			Command:  req.Operations[0].Command,
			Options:  req.Operations[0].Options,
			Services: req.Operations[0].Services,
		}
	}
	return operations.OperationRequest{}
}

func (req *TriggerWebhookRequest) ToOperationRequests() []operations.OperationRequest {
	if req.Command != "" {

		return []operations.OperationRequest{
			{
				Command:  req.Command,
				Options:  req.Options,
				Services: req.Services,
			},
		}
	}

	requests := make([]operations.OperationRequest, len(req.Operations))
	for i, op := range req.Operations {
		requests[i] = operations.OperationRequest{
			Command:  op.Command,
			Options:  op.Options,
			Services: op.Services,
		}
	}
	return requests
}

func (req *TriggerWebhookRequest) Validate() error {
	if req.APIKey == "" {
		return fmt.Errorf("api_key is required")
	}
	if req.ServerID == 0 {
		return fmt.Errorf("server_id is required")
	}
	if req.StackName == "" {
		return fmt.Errorf("stack_name is required")
	}

	if req.Command == "" && len(req.Operations) == 0 {
		return fmt.Errorf("either command or operations must be specified")
	}

	if req.Command != "" && len(req.Operations) > 0 {
		return fmt.Errorf("cannot specify both command and operations")
	}

	for i, op := range req.Operations {
		if op.Command == "" {
			return fmt.Errorf("operation %d: command is required", i+1)
		}
	}

	return nil
}
