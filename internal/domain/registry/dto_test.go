package registry

import (
	"errors"
	"testing"
)

func TestUpdateCredentialRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     UpdateCredentialRequest
		wantErr error
	}{
		{"all empty", UpdateCredentialRequest{}, ErrCredentialUpdateFieldsRequired},
		{"empty registry_url", UpdateCredentialRequest{Username: "alice"}, ErrCredentialUpdateFieldsRequired},
		{"empty username", UpdateCredentialRequest{RegistryURL: "ghcr.io"}, ErrCredentialUpdateFieldsRequired},
		{"required fields present", UpdateCredentialRequest{RegistryURL: "ghcr.io", Username: "alice"}, nil},
		{"password optional", UpdateCredentialRequest{RegistryURL: "ghcr.io", Username: "alice", Password: ""}, nil},
		{"with password change", UpdateCredentialRequest{RegistryURL: "ghcr.io", Username: "alice", Password: "newpw"}, nil},
		{"all fields present", UpdateCredentialRequest{StackPattern: "*", RegistryURL: "ghcr.io", ImagePattern: "myrepo/*", Username: "alice", Password: "pw"}, nil},
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

func TestCreateCredentialRequest_Validate(t *testing.T) {
	full := CreateCredentialRequest{
		RegistryURL: "ghcr.io",
		Username:    "alice",
		Password:    "pw",
	}

	tests := []struct {
		name    string
		mutate  func(r *CreateCredentialRequest)
		wantErr error
	}{
		{"all present", func(r *CreateCredentialRequest) {}, nil},
		{"empty registry_url", func(r *CreateCredentialRequest) { r.RegistryURL = "" }, ErrCredentialFieldsRequired},
		{"empty username", func(r *CreateCredentialRequest) { r.Username = "" }, ErrCredentialFieldsRequired},
		{"empty password", func(r *CreateCredentialRequest) { r.Password = "" }, ErrCredentialFieldsRequired},
		{"all empty", func(r *CreateCredentialRequest) { *r = CreateCredentialRequest{} }, ErrCredentialFieldsRequired},
		{"stack_pattern optional", func(r *CreateCredentialRequest) { r.StackPattern = "" }, nil},
		{"image_pattern optional", func(r *CreateCredentialRequest) { r.ImagePattern = "" }, nil},
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
