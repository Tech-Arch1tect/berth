package auth

import (
	"errors"
	"testing"
)

func TestLoginFormRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     LoginFormRequest
		wantErr error
	}{
		{"both empty", LoginFormRequest{}, ErrLoginCredentialsRequired},
		{"empty username", LoginFormRequest{Password: "pw"}, ErrLoginCredentialsRequired},
		{"empty password", LoginFormRequest{Username: "alice"}, ErrLoginCredentialsRequired},
		{"both present", LoginFormRequest{Username: "alice", Password: "pw"}, nil},
		{"with remember_me", LoginFormRequest{Username: "alice", Password: "pw", RememberMe: true}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestPasswordResetRequestForm_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     PasswordResetRequestForm
		wantErr error
	}{
		{"empty email", PasswordResetRequestForm{}, ErrPasswordResetEmailRequired},
		{"present email", PasswordResetRequestForm{Email: "alice@example.com"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestPasswordResetConfirmForm_Validate(t *testing.T) {
	full := PasswordResetConfirmForm{
		Token:           "tok",
		Password:        "pw",
		PasswordConfirm: "pw",
	}

	tests := []struct {
		name    string
		mutate  func(f *PasswordResetConfirmForm)
		wantErr error
	}{
		{"all present", func(f *PasswordResetConfirmForm) {}, nil},
		{"empty token checked first", func(f *PasswordResetConfirmForm) { f.Token = "" }, ErrPasswordResetTokenRequired},
		{"empty password", func(f *PasswordResetConfirmForm) { f.Password = "" }, ErrPasswordResetPasswordsRequired},
		{"empty confirm", func(f *PasswordResetConfirmForm) { f.PasswordConfirm = "" }, ErrPasswordResetPasswordsRequired},
		{"both empty", func(f *PasswordResetConfirmForm) { f.Password = ""; f.PasswordConfirm = "" }, ErrPasswordResetPasswordsRequired},
		{"mismatch", func(f *PasswordResetConfirmForm) { f.PasswordConfirm = "different" }, ErrPasswordResetPasswordsMismatch},
		{"token wins over password issues", func(f *PasswordResetConfirmForm) { f.Token = ""; f.Password = "" }, ErrPasswordResetTokenRequired},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := full
			tt.mutate(&f)
			got := f.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestResendVerificationForm_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ResendVerificationForm
		wantErr error
	}{
		{"empty email", ResendVerificationForm{}, ErrResendVerificationEmailRequired},
		{"present email", ResendVerificationForm{Email: "alice@example.com"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestTOTPVerifyForm_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     TOTPVerifyForm
		wantErr error
	}{
		{"empty code", TOTPVerifyForm{Code: ""}, ErrTOTPVerifyCodeRequired},
		{"present code", TOTPVerifyForm{Code: "123456"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}
