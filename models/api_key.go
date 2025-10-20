package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type APIKey struct {
	BaseModel
	UserID     uint          `json:"user_id" gorm:"not null;index"`
	Name       string        `json:"name" gorm:"not null"`
	KeyPrefix  string        `json:"key_prefix" gorm:"not null;size:12"`
	KeyHash    string        `json:"-" gorm:"not null;uniqueIndex"`
	LastUsedAt *time.Time    `json:"last_used_at"`
	ExpiresAt  *time.Time    `json:"expires_at"`
	IsActive   bool          `json:"is_active" gorm:"default:true;index"`
	User       User          `json:"user" gorm:"foreignKey:UserID"`
	Scopes     []APIKeyScope `json:"scopes" gorm:"foreignKey:APIKeyID"`
}

func (a *APIKey) BeforeDelete(tx *gorm.DB) error {
	if a.DeletedAt.Time.IsZero() {
		timestamp := time.Now().Unix()
		newKeyHash := fmt.Sprintf("%s-deleted-%d", a.KeyHash, timestamp)
		return tx.Model(a).Update("key_hash", newKeyHash).Error
	}
	return nil
}

type APIKeyResponse struct {
	ID         uint    `json:"id"`
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  string  `json:"updated_at"`
	Name       string  `json:"name"`
	KeyPrefix  string  `json:"key_prefix"`
	LastUsedAt *string `json:"last_used_at"`
	ExpiresAt  *string `json:"expires_at"`
	IsActive   bool    `json:"is_active"`
	ScopeCount int     `json:"scope_count"`
}

func (a *APIKey) ToResponse() APIKeyResponse {
	var lastUsedAt *string
	if a.LastUsedAt != nil {
		formatted := a.LastUsedAt.Format("2006-01-02T15:04:05Z07:00")
		lastUsedAt = &formatted
	}

	var expiresAt *string
	if a.ExpiresAt != nil {
		formatted := a.ExpiresAt.Format("2006-01-02T15:04:05Z07:00")
		expiresAt = &formatted
	}

	return APIKeyResponse{
		ID:         a.ID,
		CreatedAt:  a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  a.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:       a.Name,
		KeyPrefix:  a.KeyPrefix,
		LastUsedAt: lastUsedAt,
		ExpiresAt:  expiresAt,
		IsActive:   a.IsActive,
		ScopeCount: len(a.Scopes),
	}
}

func (a *APIKey) IsExpired() bool {
	if a.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*a.ExpiresAt)
}

func (a *APIKey) IsValid() bool {
	return a.IsActive && !a.IsExpired()
}
