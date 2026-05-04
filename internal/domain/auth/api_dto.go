package auth

import "berth/internal/domain/user"

type AuthLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthRefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthTOTPVerifyRequest struct {
	Code string `json:"code"`
}

type AuthLogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthLoginData struct {
	AccessToken      string        `json:"access_token"`
	RefreshToken     string        `json:"refresh_token"`
	TokenType        string        `json:"token_type"`
	ExpiresIn        int           `json:"expires_in"`
	RefreshExpiresIn int           `json:"refresh_expires_in"`
	User             user.UserInfo `json:"user"`
}

type AuthTOTPRequiredData struct {
	Message        string `json:"message"`
	TOTPRequired   bool   `json:"totp_required"`
	TemporaryToken string `json:"temporary_token"`
}

type AuthRefreshData struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
}

type AuthLogoutData struct {
	Message       string   `json:"message"`
	RevokedTokens []string `json:"revoked_tokens"`
}
