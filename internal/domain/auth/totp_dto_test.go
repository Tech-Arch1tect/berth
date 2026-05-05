package auth

import (
	"errors"
	"testing"
)

func TestTOTPEnableRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     TOTPEnableRequest
		wantErr error
	}{
		{"empty code", TOTPEnableRequest{Code: ""}, ErrTOTPEnableCodeRequired},
		{"present code", TOTPEnableRequest{Code: "123456"}, nil},
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

func TestTOTPDisableRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     TOTPDisableRequest
		wantErr error
	}{
		{"empty both", TOTPDisableRequest{Code: "", Password: ""}, ErrTOTPDisableCredentialsRequired},
		{"empty code", TOTPDisableRequest{Code: "", Password: "pw"}, ErrTOTPDisableCredentialsRequired},
		{"empty password", TOTPDisableRequest{Code: "123456", Password: ""}, ErrTOTPDisableCredentialsRequired},
		{"both present", TOTPDisableRequest{Code: "123456", Password: "pw"}, nil},
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
