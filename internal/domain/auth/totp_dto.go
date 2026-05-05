package auth

import "errors"

var (
	ErrTOTPEnableCodeRequired         = errors.New("TOTP code is required")
	ErrTOTPDisableCredentialsRequired = errors.New("TOTP code and password are required to disable 2FA")
)

type TOTPEnableRequest struct {
	Code string `json:"code"`
}

func (r *TOTPEnableRequest) Validate() error {
	if r.Code == "" {
		return ErrTOTPEnableCodeRequired
	}
	return nil
}

type TOTPDisableRequest struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

func (r *TOTPDisableRequest) Validate() error {
	if r.Code == "" || r.Password == "" {
		return ErrTOTPDisableCredentialsRequired
	}
	return nil
}

type TOTPStatusData struct {
	Enabled bool `json:"enabled"`
}

type TOTPSetupData struct {
	QRCodeURI string `json:"qr_code_uri"`
	Secret    string `json:"secret"`
}

type TOTPMessageData struct {
	Message string `json:"message"`
}
