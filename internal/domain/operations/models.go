package operations

import "time"

type RegistryCredential struct {
	Registry string `json:"registry"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type OperationStartData struct {
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
