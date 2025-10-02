package operations

import "time"

type OperationRequest struct {
	Command  string   `json:"command"`
	Options  []string `json:"options"`
	Services []string `json:"services"`
}

type OperationResponse struct {
	OperationID string `json:"operationId"`
}

type StreamMessage struct {
	Type      string    `json:"type"`
	Data      string    `json:"data,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Success   *bool     `json:"success,omitempty"`
	ExitCode  *int      `json:"exitCode,omitempty"`
}

type StreamMessageType string

const (
	StreamTypeStdout   StreamMessageType = "stdout"
	StreamTypeStderr   StreamMessageType = "stderr"
	StreamTypeProgress StreamMessageType = "progress"
	StreamTypeComplete StreamMessageType = "complete"
	StreamTypeError    StreamMessageType = "error"
)

type CompleteMessage struct {
	Type      StreamMessageType `json:"type"`
	Success   bool              `json:"success"`
	ExitCode  int               `json:"exitCode"`
	Timestamp time.Time         `json:"timestamp"`
}

type WebSocketMessage struct {
	Type    string `json:"type"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

const (
	WSMessageTypeOperationRequest = "operation_request"
	WSMessageTypeOperationStarted = "operation_started"
	WSMessageTypeStreamData       = "stream_data"
	WSMessageTypeError            = "error"
	WSMessageTypeComplete         = "complete"
)
