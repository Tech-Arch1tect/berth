package stack

import (
	"errors"
	"testing"
)

func TestCreateStackRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateStackRequest
		wantErr error
	}{
		{"empty name", CreateStackRequest{Name: ""}, ErrStackNameRequired},
		{"single char name", CreateStackRequest{Name: "x"}, nil},
		{"normal name", CreateStackRequest{Name: "my-stack"}, nil},
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
