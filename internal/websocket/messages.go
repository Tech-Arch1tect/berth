package websocket

type MessageType string

const (
	MessageTypeSubscribe         MessageType = "subscribe"
	MessageTypeUnsubscribe       MessageType = "unsubscribe"
	MessageTypeContainerStatus   MessageType = "container_status"
	MessageTypeStackStatus       MessageType = "stack_status"
	MessageTypeOperationProgress MessageType = "operation_progress"
	MessageTypeError             MessageType = "error"
	MessageTypeSuccess           MessageType = "success"
)

type BaseMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
}

type SubscribeMessage struct {
	BaseMessage
	Resource  string `json:"resource"`
	ServerID  int    `json:"server_id"`
	StackName string `json:"stack_name,omitempty"`
}

type UnsubscribeMessage struct {
	BaseMessage
	Resource  string `json:"resource"`
	ServerID  int    `json:"server_id"`
	StackName string `json:"stack_name,omitempty"`
}

type ContainerStatusEvent struct {
	BaseMessage
	ServerID      int    `json:"server_id"`
	StackName     string `json:"stack_name"`
	ServiceName   string `json:"service_name"`
	ContainerName string `json:"container_name"`
	ContainerID   string `json:"container_id"`
	Status        string `json:"status"`
	Health        string `json:"health,omitempty"`
	Image         string `json:"image"`
	Ports         []Port `json:"ports,omitempty"`
}

type Port struct {
	Private int    `json:"private"`
	Public  int    `json:"public,omitempty"`
	Type    string `json:"type"`
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

type OperationProgressEvent struct {
	BaseMessage
	ServerID     int    `json:"server_id"`
	StackName    string `json:"stack_name"`
	Operation    string `json:"operation"`
	RawOutput    string `json:"raw_output"`
	ProgressStep string `json:"progress_step,omitempty"`
	ExitCode     int    `json:"exit_code,omitempty"`
	Completed    bool   `json:"completed"`
}

type ErrorEvent struct {
	BaseMessage
	Error   string `json:"error"`
	Context string `json:"context,omitempty"`
}

type SuccessEvent struct {
	BaseMessage
	Message string `json:"message"`
	Context string `json:"context,omitempty"`
}
