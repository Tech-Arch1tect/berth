package stack

type Stack struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	ComposeFile string `json:"compose_file"`
	ServerID    uint   `json:"server_id"`
	ServerName  string `json:"server_name"`
}
