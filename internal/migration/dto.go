package migration

type ExportRequest struct {
	Password string `json:"password"`
}

type ImportResponse struct {
	Success bool               `json:"success"`
	Data    ImportResponseData `json:"data"`
}

type ImportResponseData struct {
	EncryptionSecret string        `json:"encryption_secret"`
	Summary          ImportSummary `json:"summary"`
}
