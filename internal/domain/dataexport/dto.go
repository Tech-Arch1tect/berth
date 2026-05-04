package dataexport

import "errors"

const minExportPasswordLength = 12

var (
	ErrExportPasswordRequired = errors.New("Password is required")
	ErrExportPasswordTooShort = errors.New("Password must be at least 12 characters long")
)

type ExportRequest struct {
	Password string `json:"password"`
}

func (r *ExportRequest) Validate() error {
	if r.Password == "" {
		return ErrExportPasswordRequired
	}
	if len(r.Password) < minExportPasswordLength {
		return ErrExportPasswordTooShort
	}
	return nil
}

type ImportData struct {
	EncryptionSecret string        `json:"encryption_secret"`
	Summary          ImportSummary `json:"summary"`
}
