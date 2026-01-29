package handlers

import "berth/internal/dto"

type AuthLoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type AuthRefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type AuthTOTPVerifyRequest struct {
	Code string `json:"code" validate:"required"`
}

type AuthLogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type AuthLoginResponse struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"refresh_token"`
	TokenType        string       `json:"token_type"`
	ExpiresIn        int          `json:"expires_in"`
	RefreshExpiresIn int          `json:"refresh_expires_in"`
	User             dto.UserInfo `json:"user"`
}

type AuthTOTPRequiredResponse struct {
	Message        string `json:"message"`
	TOTPRequired   bool   `json:"totp_required"`
	TemporaryToken string `json:"temporary_token"`
}

type AuthRefreshResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
}

type AuthLogoutResponse struct {
	Message       string   `json:"message"`
	RevokedTokens []string `json:"revoked_tokens"`
}

type AuthErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
