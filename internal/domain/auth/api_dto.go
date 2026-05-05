package auth

import (
	"errors"

	"berth/internal/domain/user"
)

var (
	ErrAuthCredentialsRequired = errors.New("Username and password are required")
	ErrAuthRefreshRequired     = errors.New("Refresh token is required")
	ErrAuthTOTPCodeRequired    = errors.New("TOTP code is required")
)

type AuthLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (r *AuthLoginRequest) Validate() error {
	if r.Username == "" || r.Password == "" {
		return ErrAuthCredentialsRequired
	}
	return nil
}

type AuthRefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (r *AuthRefreshRequest) Validate() error {
	if r.RefreshToken == "" {
		return ErrAuthRefreshRequired
	}
	return nil
}

type AuthTOTPVerifyRequest struct {
	Code string `json:"code"`
}

func (r *AuthTOTPVerifyRequest) Validate() error {
	if r.Code == "" {
		return ErrAuthTOTPCodeRequired
	}
	return nil
}

type AuthLogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (r *AuthLogoutRequest) Validate() error {
	if r.RefreshToken == "" {
		return ErrAuthRefreshRequired
	}
	return nil
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
