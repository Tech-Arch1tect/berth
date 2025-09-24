package models

import (
	"time"
)

type Webhook struct {
	BaseModel
	UserID        uint       `json:"user_id" gorm:"not null;index"`
	User          User       `json:"user" gorm:"foreignKey:UserID"`
	Name          string     `json:"name" gorm:"not null"`
	Description   string     `json:"description"`
	APIKeyHash    string     `json:"-" gorm:"not null;index"`
	StackPattern  string     `json:"stack_pattern" gorm:"default:'*'"`
	IsActive      bool       `json:"is_active" gorm:"default:true"`
	LastTriggered *time.Time `json:"last_triggered"`
	TriggerCount  int64      `json:"trigger_count" gorm:"default:0"`
	ExpiresAt     *time.Time `json:"expires_at"`

	ServerScopes []uint `json:"-" gorm:"-"`
}

type WebhookServerScope struct {
	BaseModel
	WebhookID uint    `json:"webhook_id" gorm:"not null;index"`
	Webhook   Webhook `json:"webhook" gorm:"foreignKey:WebhookID"`
	ServerID  uint    `json:"server_id" gorm:"not null;index"`
	Server    Server  `json:"server" gorm:"foreignKey:ServerID"`
}

type WebhookResponse struct {
	ID            uint       `json:"id"`
	CreatedAt     string     `json:"created_at"`
	UpdatedAt     string     `json:"updated_at"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	StackPattern  string     `json:"stack_pattern"`
	IsActive      bool       `json:"is_active"`
	LastTriggered *time.Time `json:"last_triggered"`
	TriggerCount  int64      `json:"trigger_count"`
	ExpiresAt     *time.Time `json:"expires_at"`
	ServerScopes  []uint     `json:"server_scopes,omitempty"`
}

type WebhookWithAPIKey struct {
	WebhookResponse
	APIKey string `json:"api_key"`
}

func (w *Webhook) ToResponse() WebhookResponse {
	return WebhookResponse{
		ID:            w.ID,
		CreatedAt:     w.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     w.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:          w.Name,
		Description:   w.Description,
		StackPattern:  w.StackPattern,
		IsActive:      w.IsActive,
		LastTriggered: w.LastTriggered,
		TriggerCount:  w.TriggerCount,
		ExpiresAt:     w.ExpiresAt,
	}
}

func (w *Webhook) ToResponseWithAPIKey(apiKey string) WebhookWithAPIKey {
	response := w.ToResponse()
	return WebhookWithAPIKey{
		WebhookResponse: response,
		APIKey:          apiKey,
	}
}
