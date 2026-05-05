package operations

import (
	"errors"
	"testing"
)

func TestOperationRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     OperationRequest
		wantErr error
	}{
		{"empty command", OperationRequest{Command: ""}, ErrOperationCommandRequired},
		{"command set", OperationRequest{Command: "up"}, nil},
		{"command set with options ignored", OperationRequest{Command: "up", Options: []string{"-d"}}, nil},
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
