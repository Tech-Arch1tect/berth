package handlers

type VersionData struct {
	Version string `json:"version"`
}

type GetVersionResponse struct {
	Success bool        `json:"success"`
	Data    VersionData `json:"data"`
}
