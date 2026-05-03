package auth

type TOTPEnableRequest struct {
	Code string `json:"code" validate:"required"`
}

type TOTPDisableRequest struct {
	Code     string `json:"code" validate:"required"`
	Password string `json:"password" validate:"required"`
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
