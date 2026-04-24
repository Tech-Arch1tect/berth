package apikey

import (
	"fmt"
	"time"

	"berth/internal/domain/server"
	"berth/internal/domain/user"
	"berth/internal/platform/db"

	"gorm.io/gorm"
)

type APIKey struct {
	db.BaseModel
	UserID     uint          `json:"user_id" gorm:"not null;index"`
	Name       string        `json:"name" gorm:"not null"`
	KeyPrefix  string        `json:"key_prefix" gorm:"not null;size:12"`
	KeyHash    string        `json:"-" gorm:"not null;uniqueIndex"`
	LastUsedAt *time.Time    `json:"last_used_at"`
	ExpiresAt  *time.Time    `json:"expires_at"`
	IsActive   bool          `json:"is_active" gorm:"default:true;index"`
	User       user.User     `json:"user" gorm:"foreignKey:UserID"`
	Scopes     []APIKeyScope `json:"scopes" gorm:"foreignKey:APIKeyID"`
}

func (a *APIKey) BeforeDelete(tx *gorm.DB) error {
	if a.DeletedAt.Time.IsZero() {
		timestamp := time.Now().Unix()
		newKeyHash := fmt.Sprintf("%s-deleted-%d", a.KeyHash, timestamp)
		return tx.Model(a).Where("id = ?", a.ID).Update("key_hash", newKeyHash).Error
	}
	return nil
}

type APIKeyInfo struct {
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

func (a *APIKey) ToResponse() APIKeyInfo {
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

	return APIKeyInfo{
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

type APIKeyScope struct {
	db.BaseModel
	APIKeyID     uint            `json:"api_key_id" gorm:"not null;index"`
	ServerID     *uint           `json:"server_id" gorm:"index"`
	StackPattern string          `json:"stack_pattern" gorm:"not null;default:'*'"`
	PermissionID uint            `json:"permission_id" gorm:"not null"`
	APIKey       APIKey          `json:"api_key" gorm:"foreignKey:APIKeyID"`
	Server       *server.Server  `json:"server" gorm:"foreignKey:ServerID"`
	Permission   user.Permission `json:"permission" gorm:"foreignKey:PermissionID"`
}

func (APIKeyScope) TableName() string {
	return "api_key_scopes"
}

type APIKeyScopeInfo struct {
	ID           uint   `json:"id"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
	APIKeyID     uint   `json:"api_key_id"`
	ServerID     *uint  `json:"server_id"`
	ServerName   string `json:"server_name,omitempty"`
	StackPattern string `json:"stack_pattern"`
	PermissionID uint   `json:"permission_id"`
	Permission   string `json:"permission"`
}

func (s *APIKeyScope) ToResponse() APIKeyScopeInfo {
	resp := APIKeyScopeInfo{
		ID:           s.ID,
		CreatedAt:    s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		APIKeyID:     s.APIKeyID,
		ServerID:     s.ServerID,
		StackPattern: s.StackPattern,
		PermissionID: s.PermissionID,
		Permission:   s.Permission.Name,
	}

	if s.Server != nil {
		resp.ServerName = s.Server.Name
	}

	return resp
}
