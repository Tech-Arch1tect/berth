package server

import (
	"errors"
	"testing"
)

func TestServerCreateRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ServerCreateRequest
		wantErr error
	}{
		{"empty access token", ServerCreateRequest{Name: "n", Host: "h", AccessToken: ""}, ErrServerAccessTokenRequired},
		{"all empty", ServerCreateRequest{}, ErrServerAccessTokenRequired},
		{"with token", ServerCreateRequest{Name: "n", Host: "h", AccessToken: "abc"}, nil},
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
