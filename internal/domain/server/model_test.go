package server

import (
	"errors"
	"testing"
)

func TestServerCreateRequest_Validate(t *testing.T) {
	full := ServerCreateRequest{
		Name:        "n",
		Host:        "h",
		Port:        8080,
		AccessToken: "abc",
	}

	tests := []struct {
		name    string
		mutate  func(r *ServerCreateRequest)
		wantErr error
	}{
		{"all required present", func(r *ServerCreateRequest) {}, nil},
		{"empty name", func(r *ServerCreateRequest) { r.Name = "" }, ErrServerNameRequired},
		{"empty host", func(r *ServerCreateRequest) { r.Host = "" }, ErrServerHostRequired},
		{"zero port", func(r *ServerCreateRequest) { r.Port = 0 }, ErrServerPortRequired},
		{"negative port", func(r *ServerCreateRequest) { r.Port = -1 }, ErrServerPortRequired},
		{"empty access token", func(r *ServerCreateRequest) { r.AccessToken = "" }, ErrServerAccessTokenRequired},
		{"name checked first", func(r *ServerCreateRequest) { r.Name = ""; r.Host = ""; r.Port = 0; r.AccessToken = "" }, ErrServerNameRequired},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := full
			tt.mutate(&req)
			got := req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestServerUpdateRequest_Validate(t *testing.T) {
	full := ServerUpdateRequest{
		Name: "n",
		Host: "h",
		Port: 8080,
	}

	tests := []struct {
		name    string
		mutate  func(r *ServerUpdateRequest)
		wantErr error
	}{
		{"required fields present", func(r *ServerUpdateRequest) {}, nil},
		{"empty name", func(r *ServerUpdateRequest) { r.Name = "" }, ErrServerNameRequired},
		{"empty host", func(r *ServerUpdateRequest) { r.Host = "" }, ErrServerHostRequired},
		{"zero port", func(r *ServerUpdateRequest) { r.Port = 0 }, ErrServerPortRequired},
		{"negative port", func(r *ServerUpdateRequest) { r.Port = -1 }, ErrServerPortRequired},
		{"empty access token allowed", func(r *ServerUpdateRequest) { r.AccessToken = "" }, nil},
		{"with access token", func(r *ServerUpdateRequest) { r.AccessToken = "new-token" }, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := full
			tt.mutate(&req)
			got := req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}
