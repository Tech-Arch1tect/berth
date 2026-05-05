package auth

import (
	"errors"
	"testing"
)

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
