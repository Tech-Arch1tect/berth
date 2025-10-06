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
	UserID      uint            `json:"user_id" gorm:"not null;index"`
	User        User            `json:"user" gorm:"foreignKey:UserID"`
	ServerID    uint            `json:"server_id" gorm:"not null;index"`
	Server      Server          `json:"server" gorm:"foreignKey:ServerID"`
	StackName   string          `json:"stack_name" gorm:"not null;index"`
	Command     string          `json:"command" gorm:"not null"`
	Options     string          `json:"options" gorm:"type:text"`
	Services    string          `json:"services" gorm:"type:text"`
	Status      OperationStatus `json:"status" gorm:"not null;default:'queued'"`
	QueuedAt    time.Time       `json:"queued_at" gorm:"not null"`
	Priority    int             `json:"priority" gorm:"default:0"`
}

type QueuedOperationResponse struct {
	ID               uint            `json:"id"`
	OperationID      string          `json:"operation_id"`
	UserName         string          `json:"user_name"`
	ServerName       string          `json:"server_name"`
	StackName        string          `json:"stack_name"`
	Command          string          `json:"command"`
	Options          []string        `json:"options"`
	Services         []string        `json:"services"`
	Status           OperationStatus `json:"status"`
	QueuedAt         string          `json:"queued_at"`
	Priority         int             `json:"priority"`
	PositionInQueue  int             `json:"position_in_queue"`
	EstimatedStartAt *string         `json:"estimated_start_at,omitempty"`
}

func (qo *QueuedOperation) ToResponse() QueuedOperationResponse {
	var options []string
	var services []string

	if qo.Options != "" {

		options = parseJSONStringArray(qo.Options)
	}

	if qo.Services != "" {

		services = parseJSONStringArray(qo.Services)
	}

	return QueuedOperationResponse{
		ID:          qo.ID,
		OperationID: qo.OperationID,
		UserName:    qo.User.Username,
		ServerName:  qo.Server.Name,
		StackName:   qo.StackName,
		Command:     qo.Command,
		Options:     options,
		Services:    services,
		Status:      qo.Status,
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
