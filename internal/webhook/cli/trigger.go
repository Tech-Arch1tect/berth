package cli

import (
	"fmt"
	"os"
)

type Config struct {
	WebhookID      uint
	APIKey         string
	ServerID       uint
	StackName      string
	Command        string
	Options        []string
	Services       []string
	BerthURL       string
	Insecure       bool
	Verbose        bool
	TimeoutMinutes int
}

const (
	ExitSuccess          = 0
	ExitOperationFailed  = 1
	ExitAuthFailed       = 2
	ExitPermissionDenied = 3
	ExitValidationError  = 4
	ExitNetworkError     = 5
	ExitTimeout          = 6
	ExitInternalError    = 7
)

func Run(config *Config) int {
	if config.Verbose {
		fmt.Fprintf(os.Stderr, "Berth Webhook CLI\n")
		fmt.Fprintf(os.Stderr, "Webhook ID: %d\n", config.WebhookID)
		fmt.Fprintf(os.Stderr, "Server ID: %d\n", config.ServerID)
		fmt.Fprintf(os.Stderr, "Stack: %s\n", config.StackName)
		fmt.Fprintf(os.Stderr, "Command: %s\n", config.Command)
		if len(config.Options) > 0 {
			fmt.Fprintf(os.Stderr, "Options: %v\n", config.Options)
		}
		if len(config.Services) > 0 {
			fmt.Fprintf(os.Stderr, "Services: %v\n", config.Services)
		}
		fmt.Fprintf(os.Stderr, "---\n")
	}

	client := NewClient(config.BerthURL, config.Insecure, config.Verbose, config.TimeoutMinutes)

	req := TriggerRequest{
		APIKey:    config.APIKey,
		ServerID:  config.ServerID,
		StackName: config.StackName,
		Command:   config.Command,
		Options:   config.Options,
		Services:  config.Services,
	}

	fmt.Fprintf(os.Stderr, "Triggering webhook operation...\n")

	resp, err := client.TriggerWebhook(config.WebhookID, req)
	if err != nil {
		return handleError(err)
	}

	fmt.Fprintf(os.Stderr, "Operation queued: %s\n", resp.OperationID)
	if resp.PositionInQueue > 1 {
		fmt.Fprintf(os.Stderr, "Position in queue: %d\n", resp.PositionInQueue)
	}
	fmt.Fprintf(os.Stderr, "\n")

	completeMsg, err := client.StreamOperationLogs(resp.OperationID, config.APIKey, func(data string) {

		if len(data) > 0 && data[len(data)-1] != '\n' {
			fmt.Fprintln(os.Stdout, data)
		} else {
			fmt.Fprint(os.Stdout, data)
		}
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "\nError streaming logs: %s\n", err.Error())
		return ExitInternalError
	}

	fmt.Fprintf(os.Stderr, "\n")

	if completeMsg == nil {
		fmt.Fprintf(os.Stderr, "Operation did not complete properly\n")
		return ExitInternalError
	}

	exitCode := 0
	if completeMsg.ExitCode != nil {
		exitCode = *completeMsg.ExitCode
	}

	success := exitCode == 0
	if completeMsg.Success != nil {
		success = *completeMsg.Success
	}

	fmt.Fprintf(os.Stderr, "Operation completed: %s\n", resp.OperationID)
	fmt.Fprintf(os.Stderr, "Success: %t\n", success)
	fmt.Fprintf(os.Stderr, "Exit Code: %d\n", exitCode)

	if success {
		return ExitSuccess
	}

	return ExitOperationFailed
}

func handleError(err error) int {
	errMsg := err.Error()

	if contains(errMsg, "authentication", "invalid api key", "unauthorized") {
		fmt.Fprintf(os.Stderr, "Error: Authentication failed - %s\n", errMsg)
		return ExitAuthFailed
	}

	if contains(errMsg, "permission denied", "insufficient permissions", "forbidden", "access denied") {
		fmt.Fprintf(os.Stderr, "Error: Permission denied - %s\n", errMsg)
		return ExitPermissionDenied
	}

	if contains(errMsg, "validation", "invalid", "required", "pattern") {
		fmt.Fprintf(os.Stderr, "Error: Validation failed - %s\n", errMsg)
		return ExitValidationError
	}

	if contains(errMsg, "timeout", "timed out", "deadline exceeded") {
		fmt.Fprintf(os.Stderr, "Error: Operation timed out - %s\n", errMsg)
		return ExitTimeout
	}

	if contains(errMsg, "connection", "network", "dial", "EOF") {
		fmt.Fprintf(os.Stderr, "Error: Network error - %s\n", errMsg)
		return ExitNetworkError
	}

	fmt.Fprintf(os.Stderr, "Error: %s\n", errMsg)
	return ExitInternalError
}

func contains(str string, substrs ...string) bool {
	for _, substr := range substrs {
		if containsCaseInsensitive(str, substr) {
			return true
		}
	}
	return false
}

func containsCaseInsensitive(str, substr string) bool {
	str = toLower(str)
	substr = toLower(substr)
	return indexOf(str, substr) >= 0
}

func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result[i] = c + ('a' - 'A')
		} else {
			result[i] = c
		}
	}
	return string(result)
}

func indexOf(s, substr string) int {
	n := len(substr)
	if n == 0 {
		return 0
	}
	if n > len(s) {
		return -1
	}
	for i := 0; i <= len(s)-n; i++ {
		if s[i:i+n] == substr {
			return i
		}
	}
	return -1
}
