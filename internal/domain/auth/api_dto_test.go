package auth

import (
	"errors"
	"testing"
)

func TestAuthLoginRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthLoginRequest
		wantErr error
	}{
		{"empty both", AuthLoginRequest{Username: "", Password: ""}, ErrAuthCredentialsRequired},
		{"empty username", AuthLoginRequest{Username: "", Password: "pw"}, ErrAuthCredentialsRequired},
		{"empty password", AuthLoginRequest{Username: "alice", Password: ""}, ErrAuthCredentialsRequired},
		{"both present", AuthLoginRequest{Username: "alice", Password: "pw"}, nil},
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

func TestAuthRefreshRequest_Validate(t *testing.T) {
	tests := []struct {
		name string
		req  AuthRefreshRequest
	}{
		{"empty token (cookie fallback may supply it)", AuthRefreshRequest{RefreshToken: ""}},
		{"present token", AuthRefreshRequest{RefreshToken: "abc"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.req.Validate(); got != nil {
				t.Errorf("Validate() = %v, want nil (refresh_token is optional)", got)
			}
		})
	}
}

func TestAuthLogoutRequest_Validate(t *testing.T) {
	tests := []struct {
		name string
		req  AuthLogoutRequest
	}{
		{"empty token (cookie fallback may supply it)", AuthLogoutRequest{RefreshToken: ""}},
		{"present token", AuthLogoutRequest{RefreshToken: "abc"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.req.Validate(); got != nil {
				t.Errorf("Validate() = %v, want nil (refresh_token is optional)", got)
			}
		})
	}
}

func TestAuthTOTPVerifyRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthTOTPVerifyRequest
		wantErr error
	}{
		{"empty code", AuthTOTPVerifyRequest{Code: ""}, ErrAuthTOTPCodeRequired},
		{"present code", AuthTOTPVerifyRequest{Code: "123456"}, nil},
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
