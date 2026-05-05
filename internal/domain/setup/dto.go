package setup

import "errors"

var (
	ErrSetupAdminFieldsRequired   = errors.New("All fields are required")
	ErrSetupAdminPasswordMismatch = errors.New("Passwords do not match")
)

type CreateInitialAdminForm struct {
	Username        string `form:"username" json:"username"`
	Email           string `form:"email" json:"email"`
	Password        string `form:"password" json:"password"`
	PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
}

func (f *CreateInitialAdminForm) Validate() error {
	if f.Username == "" || f.Email == "" || f.Password == "" {
		return ErrSetupAdminFieldsRequired
	}
	if f.Password != f.PasswordConfirm {
		return ErrSetupAdminPasswordMismatch
	}
	return nil
}
