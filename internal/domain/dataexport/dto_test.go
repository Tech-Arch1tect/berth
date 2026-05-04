package dataexport

import (
	"errors"
	"testing"
)

func TestExportRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ExportRequest
		wantErr error
	}{
		{"empty password", ExportRequest{Password: ""}, ErrExportPasswordRequired},
		{"one char short", ExportRequest{Password: "12345678901"}, ErrExportPasswordTooShort},
		{"exactly twelve chars", ExportRequest{Password: "123456789012"}, nil},
		{"long password", ExportRequest{Password: "secure-backup-password-123"}, nil},
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
