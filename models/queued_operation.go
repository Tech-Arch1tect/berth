package models

import (
	"encoding/json"
	"time"
)

type OperationStatus string

const (
	OperationStatusQueued    OperationStatus = "queued"
	OperationStatusRunning   OperationStatus = "running"
	OperationStatusCompleted OperationStatus = "completed"
	OperationStatusFailed    OperationStatus = "failed"
	OperationStatusCancelled OperationStatus = "cancelled"
)

type QueuedOperation struct {
	BaseModel
	OperationID string          `json:"operation_id" gorm:"not null;uniqueIndex"`
	BatchID     *string         `json:"batch_id" gorm:"index"`
	UserID      uint            `json:"user_id" gorm:"not null;index"`
	User        User            `json:"user" gorm:"foreignKey:UserID"`
	ServerID    uint            `json:"server_id" gorm:"not null;index"`
	Server      Server          `json:"server" gorm:"foreignKey:ServerID"`
	StackName   string          `json:"stack_name" gorm:"not null;index"`
	Command     string          `json:"command" gorm:"not null"`
	Options     string          `json:"options" gorm:"type:text"`
	Services    string          `json:"services" gorm:"type:text"`
	Status      OperationStatus `json:"status" gorm:"not null;default:'queued'"`
	Order       int             `json:"order" gorm:"default:1"`
	DependsOn   *string         `json:"depends_on" gorm:"index"`
	WebhookID   *uint           `json:"webhook_id" gorm:"index"`
	Webhook     *Webhook        `json:"webhook,omitempty" gorm:"foreignKey:WebhookID"`
	QueuedAt    time.Time       `json:"queued_at" gorm:"not null"`
	Priority    int             `json:"priority" gorm:"default:0"`
}

type QueuedOperationResponse struct {
	ID               uint            `json:"id"`
	OperationID      string          `json:"operation_id"`
	BatchID          *string         `json:"batch_id"`
	UserName         string          `json:"user_name"`
	ServerName       string          `json:"server_name"`
	StackName        string          `json:"stack_name"`
	Command          string          `json:"command"`
	Options          []string        `json:"options"`
	Services         []string        `json:"services"`
	Status           OperationStatus `json:"status"`
	Order            int             `json:"order"`
	DependsOn        *string         `json:"depends_on"`
	WebhookName      *string         `json:"webhook_name,omitempty"`
	QueuedAt         string          `json:"queued_at"`
	Priority         int             `json:"priority"`
	PositionInQueue  int             `json:"position_in_queue"`
	EstimatedStartAt *string         `json:"estimated_start_at,omitempty"`
}

type BatchOperationResponse struct {
	BatchID               string                    `json:"batch_id"`
	Operations            []QueuedOperationResponse `json:"operations"`
	EstimatedStartTime    *string                   `json:"estimated_start_time,omitempty"`
	EstimatedCompleteTime *string                   `json:"estimated_complete_time,omitempty"`
}

func (qo *QueuedOperation) ToResponse() QueuedOperationResponse {
	var options []string
	var services []string
	var webhookName *string

	if qo.Options != "" {

		options = parseJSONStringArray(qo.Options)
	}

	if qo.Services != "" {

		services = parseJSONStringArray(qo.Services)
	}

	if qo.Webhook != nil {
		webhookName = &qo.Webhook.Name
	}

	return QueuedOperationResponse{
		ID:          qo.ID,
		OperationID: qo.OperationID,
		BatchID:     qo.BatchID,
		UserName:    qo.User.Username,
		ServerName:  qo.Server.Name,
		StackName:   qo.StackName,
		Command:     qo.Command,
		Options:     options,
		Services:    services,
		Status:      qo.Status,
		Order:       qo.Order,
		DependsOn:   qo.DependsOn,
		WebhookName: webhookName,
		QueuedAt:    qo.QueuedAt.Format("2006-01-02T15:04:05Z07:00"),
		Priority:    qo.Priority,
	}
}

func parseJSONStringArray(jsonStr string) []string {
	if jsonStr == "" {
		return nil
	}

	var result []string
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil
	}

	return result
}
