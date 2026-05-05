package vulnscan

import (
	"errors"
	"testing"
)

func TestStartScanRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     StartScanRequest
		wantErr error
	}{
		{"nil services", StartScanRequest{Services: nil}, nil},
		{"empty services", StartScanRequest{Services: []string{}}, nil},
		{"populated services", StartScanRequest{Services: []string{"web", "db"}}, nil},
		{"single empty entry", StartScanRequest{Services: []string{""}}, ErrStartScanEmptyService},
		{"empty among non-empty", StartScanRequest{Services: []string{"web", "", "db"}}, ErrStartScanEmptyService},
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
