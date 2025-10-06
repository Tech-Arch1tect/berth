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

type ComposeChanges struct {
	ServiceImageUpdates []ServiceImageUpdate `json:"service_image_updates,omitempty"`
}

type ServiceImageUpdate struct {
	ServiceName string `json:"service_name"`
	NewImage    string `json:"new_image,omitempty"`
	NewTag      string `json:"new_tag,omitempty"`
}

type TriggerWebhookRequest struct {
	APIKey         string          `json:"api_key" binding:"required"`
	ServerID       uint            `json:"server_id" binding:"required"`
	StackName      string          `json:"stack_name" binding:"required"`
	Command        string          `json:"command" binding:"required"`
	Options        []string        `json:"options"`
	Services       []string        `json:"services"`
	ComposeChanges *ComposeChanges `json:"compose_changes,omitempty"`
}

type TriggerWebhookResponse struct {
	OperationID        string  `json:"operation_id"`
	Status             string  `json:"status"`
	PositionInQueue    int     `json:"position_in_queue"`
	EstimatedStartTime *string `json:"estimated_start_time,omitempty"`
}

func (req *TriggerWebhookRequest) ToOperationRequest() operations.OperationRequest {
	return operations.OperationRequest{
		Command:  req.Command,
		Options:  req.Options,
		Services: req.Services,
	}
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
	if req.Command == "" {
		return fmt.Errorf("command is required")
	}

	return nil
}
