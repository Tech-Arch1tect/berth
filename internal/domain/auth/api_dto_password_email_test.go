package auth

import (
	"errors"
	"testing"
)

func TestAuthPasswordResetRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthPasswordResetRequest
		wantErr error
	}{
		{"empty email", AuthPasswordResetRequest{Email: ""}, ErrAuthPasswordResetEmailRequired},
		{"present email", AuthPasswordResetRequest{Email: "user@example.com"}, nil},
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

func TestAuthPasswordResetConfirmRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthPasswordResetConfirmRequest
		wantErr error
	}{
		{
			"empty token",
			AuthPasswordResetConfirmRequest{Token: "", Password: "pw", PasswordConfirmation: "pw"},
			ErrAuthPasswordResetTokenRequired,
		},
		{
			"empty password",
			AuthPasswordResetConfirmRequest{Token: "abc", Password: "", PasswordConfirmation: ""},
			ErrAuthPasswordResetPasswordsRequired,
		},
		{
			"empty confirmation",
			AuthPasswordResetConfirmRequest{Token: "abc", Password: "pw", PasswordConfirmation: ""},
			ErrAuthPasswordResetPasswordsRequired,
		},
		{
			"mismatched",
			AuthPasswordResetConfirmRequest{Token: "abc", Password: "pw1", PasswordConfirmation: "pw2"},
			ErrAuthPasswordResetPasswordsMismatch,
		},
		{
			"valid",
			AuthPasswordResetConfirmRequest{Token: "abc", Password: "pw", PasswordConfirmation: "pw"},
			nil,
		},
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

func TestAuthVerifyEmailRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthVerifyEmailRequest
		wantErr error
	}{
		{"empty token", AuthVerifyEmailRequest{Token: ""}, ErrAuthVerifyEmailTokenRequired},
		{"present token", AuthVerifyEmailRequest{Token: "abc"}, nil},
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

func TestAuthResendVerificationRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthResendVerificationRequest
		wantErr error
	}{
		{"empty email", AuthResendVerificationRequest{Email: ""}, ErrAuthResendVerificationEmailRequired},
		{"present email", AuthResendVerificationRequest{Email: "user@example.com"}, nil},
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
