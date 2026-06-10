package websocket

import "berth/internal/domain/stack"

type MessageType string

const (
	MessageTypeContainerStatus   MessageType = "container_status"
	MessageTypeStackStatus       MessageType = "stack_status"
	MessageTypeOperationProgress MessageType = "operation_progress"
)

type BaseMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
}

type ContainerStatusEvent struct {
	BaseMessage
	ServerID      int          `json:"server_id"`
	StackName     string       `json:"stack_name"`
	ServiceName   string       `json:"service_name"`
	ContainerName string       `json:"container_name"`
	ContainerID   string       `json:"container_id"`
	Status        string       `json:"status"`
	Health        string       `json:"health,omitempty"`
	Image         string       `json:"image"`
	Ports         []stack.Port `json:"ports,omitempty"`
}

type StackStatusEvent struct {
	BaseMessage
	ServerID  int    `json:"server_id"`
	StackName string `json:"stack_name"`
	Status    string `json:"status"`
	Services  int    `json:"services"`
	Running   int    `json:"running"`
	Stopped   int    `json:"stopped"`
}
