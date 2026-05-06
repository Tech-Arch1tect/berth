//go:build e2e

package testsupport

import (
	"errors"
	"testing"
)

func TestSeedUserInput_Validate(t *testing.T) {
	full := SeedUserInput{
		Username: "alice",
		Email:    "alice@example.com",
		Password: "pw",
	}

	tests := []struct {
		name    string
		mutate  func(i *SeedUserInput)
		wantErr error
	}{
		{"all required present", func(i *SeedUserInput) {}, nil},
		{"empty username", func(i *SeedUserInput) { i.Username = "" }, ErrSeedUserFieldsRequired},
		{"empty email", func(i *SeedUserInput) { i.Email = "" }, ErrSeedUserFieldsRequired},
		{"empty password", func(i *SeedUserInput) { i.Password = "" }, ErrSeedUserFieldsRequired},
		{"all empty", func(i *SeedUserInput) { *i = SeedUserInput{} }, ErrSeedUserFieldsRequired},
		{"with admin and email_verified flags", func(i *SeedUserInput) { i.Admin = true; i.EmailVerified = true }, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := full
			tt.mutate(&in)
			got := in.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestSeedServerInput_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     SeedServerInput
		wantErr error
	}{
		{"empty name", SeedServerInput{}, ErrSeedServerNameRequired},
		{"present name", SeedServerInput{Name: "test-srv"}, nil},
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

func TestRegisterHandlerInput_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     registerHandlerInput
		wantErr error
	}{
		{"empty path", registerHandlerInput{}, ErrRegisterHandlerPathRequired},
		{"present path", registerHandlerInput{Path: "/api/foo"}, nil},
		{"path with status and body", registerHandlerInput{Path: "/api/foo", Status: 200, Body: []byte(`{"ok":true}`)}, nil},
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
