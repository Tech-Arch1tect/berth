package setup

import (
	"errors"
	"testing"
)

func TestCreateInitialAdminForm_Validate(t *testing.T) {
	full := CreateInitialAdminForm{
		Username:        "alice",
		Email:           "alice@example.com",
		Password:        "password123",
		PasswordConfirm: "password123",
	}

	tests := []struct {
		name    string
		mutate  func(f *CreateInitialAdminForm)
		wantErr error
	}{
		{"all present", func(f *CreateInitialAdminForm) {}, nil},
		{"empty username", func(f *CreateInitialAdminForm) { f.Username = "" }, ErrSetupAdminFieldsRequired},
		{"empty email", func(f *CreateInitialAdminForm) { f.Email = "" }, ErrSetupAdminFieldsRequired},
		{"empty password", func(f *CreateInitialAdminForm) { f.Password = "" }, ErrSetupAdminFieldsRequired},
		{"all empty", func(f *CreateInitialAdminForm) { *f = CreateInitialAdminForm{} }, ErrSetupAdminFieldsRequired},
		{"password mismatch", func(f *CreateInitialAdminForm) { f.PasswordConfirm = "different" }, ErrSetupAdminPasswordMismatch},
		{"empty confirm", func(f *CreateInitialAdminForm) { f.PasswordConfirm = "" }, ErrSetupAdminPasswordMismatch},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := full
			tt.mutate(&f)
			got := f.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}
