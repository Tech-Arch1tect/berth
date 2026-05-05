package auth

import "errors"

var (
	ErrLoginCredentialsRequired        = errors.New("Username and password are required")
	ErrPasswordResetEmailRequired      = errors.New("Email is required")
	ErrPasswordResetTokenRequired      = errors.New("Invalid password reset link")
	ErrPasswordResetPasswordsRequired  = errors.New("Password and confirmation are required")
	ErrPasswordResetPasswordsMismatch  = errors.New("Passwords do not match")
	ErrResendVerificationEmailRequired = errors.New("Email is required")
	ErrTOTPVerifyCodeRequired          = errors.New("TOTP code is required")
)

type LoginFormRequest struct {
	Username   string `form:"username" json:"username"`
	Password   string `form:"password" json:"password"`
	RememberMe bool   `form:"remember_me" json:"remember_me"`
}

func (f *LoginFormRequest) Validate() error {
	if f.Username == "" || f.Password == "" {
		return ErrLoginCredentialsRequired
	}
	return nil
}

type PasswordResetRequestForm struct {
	Email string `form:"email" json:"email"`
}

func (f *PasswordResetRequestForm) Validate() error {
	if f.Email == "" {
		return ErrPasswordResetEmailRequired
	}
	return nil
}

type PasswordResetConfirmForm struct {
	Token           string `form:"token" json:"token"`
	Password        string `form:"password" json:"password"`
	PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
}

func (f *PasswordResetConfirmForm) Validate() error {
	if f.Token == "" {
		return ErrPasswordResetTokenRequired
	}
	if f.Password == "" || f.PasswordConfirm == "" {
		return ErrPasswordResetPasswordsRequired
	}
	if f.Password != f.PasswordConfirm {
		return ErrPasswordResetPasswordsMismatch
	}
	return nil
}

type ResendVerificationForm struct {
	Email string `form:"email" json:"email"`
}

func (f *ResendVerificationForm) Validate() error {
	if f.Email == "" {
		return ErrResendVerificationEmailRequired
	}
	return nil
}

type TOTPVerifyForm struct {
	Code string `form:"code" json:"code"`
}

func (f *TOTPVerifyForm) Validate() error {
	if f.Code == "" {
		return ErrTOTPVerifyCodeRequired
	}
	return nil
}
