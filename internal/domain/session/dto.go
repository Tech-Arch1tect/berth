package session

import (
	"errors"
	"time"
)

var (
	ErrSessionRefreshRequired = errors.New("Refresh token is required")
	ErrSessionIDRequired      = errors.New("Session ID is required")
)

type RevokeSessionRequest struct {
	SessionID uint `json:"session_id"`
}

func (r *RevokeSessionRequest) Validate() error {
	if r.SessionID == 0 {
		return ErrSessionIDRequired
	}
	return nil
}

type RevokeAllOtherSessionsRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"`
}

func (r *RevokeAllOtherSessionsRequest) Validate() error {
	if r.RefreshToken == "" {
		return ErrSessionRefreshRequired
	}
	return nil
}

type GetSessionsRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (r *GetSessionsRequest) Validate() error {
	if r.RefreshToken == "" {
		return ErrSessionRefreshRequired
	}
	return nil
}

type SessionItem struct {
	ID         uint      `json:"id"`
	UserID     uint      `json:"user_id"`
	Token      string    `json:"token"`
	Type       string    `json:"type"`
	Current    bool      `json:"current"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	Location   string    `json:"location"`
	Browser    string    `json:"browser"`
	OS         string    `json:"os"`
	DeviceType string    `json:"device_type"`
	Device     string    `json:"device"`
	Mobile     bool      `json:"mobile"`
	Tablet     bool      `json:"tablet"`
	Desktop    bool      `json:"desktop"`
	Bot        bool      `json:"bot"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsed   time.Time `json:"last_used"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type GetSessionsData struct {
	Sessions []SessionItem `json:"sessions"`
}

type SessionMessageData struct {
	Message string `json:"message"`
}
