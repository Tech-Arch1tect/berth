package dataexport

type ExportRequest struct {
	Password string `json:"password"`
}

type ImportData struct {
	EncryptionSecret string        `json:"encryption_secret"`
	Summary          ImportSummary `json:"summary"`
}
