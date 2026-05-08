package auth

import "errors"

var (
	ErrAuthPasswordResetEmailRequired      = errors.New("Email is required")
	ErrAuthPasswordResetTokenRequired      = errors.New("Token is required")
	ErrAuthPasswordResetPasswordsRequired  = errors.New("Password and confirmation are required")
	ErrAuthPasswordResetPasswordsMismatch  = errors.New("Passwords do not match")
	ErrAuthVerifyEmailTokenRequired        = errors.New("Token is required")
	ErrAuthResendVerificationEmailRequired = errors.New("Email is required")
)

type AuthPasswordResetRequest struct {
	Email string `json:"email"`
}

func (r *AuthPasswordResetRequest) Validate() error {
	if r.Email == "" {
		return ErrAuthPasswordResetEmailRequired
	}
	return nil
}

type AuthPasswordResetConfirmRequest struct {
	Token                string `json:"token"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"password_confirmation"`
}

func (r *AuthPasswordResetConfirmRequest) Validate() error {
	if r.Token == "" {
		return ErrAuthPasswordResetTokenRequired
	}
	if r.Password == "" || r.PasswordConfirmation == "" {
		return ErrAuthPasswordResetPasswordsRequired
	}
	if r.Password != r.PasswordConfirmation {
		return ErrAuthPasswordResetPasswordsMismatch
	}
	return nil
}

type AuthVerifyEmailRequest struct {
	Token string `json:"token"`
}

func (r *AuthVerifyEmailRequest) Validate() error {
	if r.Token == "" {
		return ErrAuthVerifyEmailTokenRequired
	}
	return nil
}

type AuthResendVerificationRequest struct {
	Email string `json:"email"`
}

func (r *AuthResendVerificationRequest) Validate() error {
	if r.Email == "" {
		return ErrAuthResendVerificationEmailRequired
	}
	return nil
}

type AuthMessageData struct {
	Message string `json:"message"`
}
