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
	Data      string    `json:"data"`
	Timestamp time.Time `json:"timestamp"`
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
	Type     StreamMessageType `json:"type"`
	Success  bool              `json:"success"`
	ExitCode int               `json:"exitCode"`
}

type WebSocketMessage struct {
	Type    string `json:"type"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

const (
	WSMessageTypeOperationRequest = "operation_request"
	WSMessageTypeStreamData       = "stream_data"
	WSMessageTypeError            = "error"
	WSMessageTypeComplete         = "complete"
)
