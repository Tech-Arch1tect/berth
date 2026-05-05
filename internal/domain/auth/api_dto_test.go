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
		name    string
		req     AuthRefreshRequest
		wantErr error
	}{
		{"empty token", AuthRefreshRequest{RefreshToken: ""}, ErrAuthRefreshRequired},
		{"present token", AuthRefreshRequest{RefreshToken: "abc"}, nil},
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

func TestAuthLogoutRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AuthLogoutRequest
		wantErr error
	}{
		{"empty token", AuthLogoutRequest{RefreshToken: ""}, ErrAuthRefreshRequired},
		{"present token", AuthLogoutRequest{RefreshToken: "abc"}, nil},
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
