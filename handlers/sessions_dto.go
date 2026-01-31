package handlers

import "time"

type RevokeSessionRequest struct {
	SessionID uint `json:"session_id" validate:"required"`
}

type RevokeAllOtherSessionsRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"`
}

type GetSessionsRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
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

type GetSessionsResponse struct {
	Success bool            `json:"success"`
	Data    GetSessionsData `json:"data"`
}

type GetSessionsData struct {
	Sessions []SessionItem `json:"sessions"`
}

type SessionMessageResponse struct {
	Success bool               `json:"success"`
	Data    SessionMessageData `json:"data"`
}

type SessionMessageData struct {
	Message string `json:"message"`
}
