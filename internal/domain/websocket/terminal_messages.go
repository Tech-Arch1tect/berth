package websocket

type TerminalStartMessage struct {
	Type          string `json:"type" doc:"Always terminal_start"`
	StackName     string `json:"stack_name,omitempty" doc:"Optional; must match the URL stack when set"`
	ServiceName   string `json:"service_name"`
	ContainerName string `json:"container_name,omitempty"`
	Cols          int    `json:"cols,omitempty"`
	Rows          int    `json:"rows,omitempty"`
}

type TerminalInputMessage struct {
	Type      string `json:"type" doc:"Always terminal_input"`
	SessionID string `json:"session_id"`
	Timestamp string `json:"timestamp,omitempty"`
	Input     []int  `json:"input" doc:"Raw input bytes as integer values"`
}

type TerminalResizeMessage struct {
	Type      string `json:"type" doc:"Always terminal_resize"`
	SessionID string `json:"session_id"`
	Timestamp string `json:"timestamp,omitempty"`
	Cols      int    `json:"cols"`
	Rows      int    `json:"rows"`
}

type TerminalCloseMessage struct {
	Type      string `json:"type" doc:"Always terminal_close"`
	SessionID string `json:"session_id"`
	Timestamp string `json:"timestamp,omitempty"`
	ExitCode  int    `json:"exit_code,omitempty"`
}

type TerminalOutputMessage struct {
	Type      string `json:"type" doc:"Always terminal_output"`
	SessionID string `json:"session_id"`
	Timestamp string `json:"timestamp,omitempty"`
	Output    string `json:"output" doc:"Base64-encoded output bytes"`
}

type TerminalSuccessMessage struct {
	Type      string `json:"type" doc:"Always success"`
	Message   string `json:"message,omitempty"`
	SessionID string `json:"session_id"`
	Timestamp string `json:"timestamp,omitempty"`
}

type TerminalErrorMessage struct {
	Type      string `json:"type" doc:"Always error"`
	Error     string `json:"error"`
	Timestamp string `json:"timestamp,omitempty"`
}
