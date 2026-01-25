package handlers

type RevokeSessionRequest struct {
	SessionID uint `json:"session_id" validate:"required"`
}

type RevokeAllOtherSessionsRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"`
}

type SessionMessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
