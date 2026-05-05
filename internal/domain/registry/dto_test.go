package registry

import (
	"errors"
	"testing"
)

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
