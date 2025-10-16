package commands

import (
	"berth/internal/cli"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/spf13/cobra"
)

var (
	execServerID      string
	execStackName     string
	execServiceName   string
	execContainerName string
	execCommand       string
)

var execCmd = &cobra.Command{
	Use:   "exec",
	Short: "Execute a command in a container",
	Long: `Execute a command in a Docker container via the terminal websocket.

This command connects to a container's terminal and executes a command,
capturing its output and exit code. It uses the same infrastructure as
interactive terminals but runs non-interactively.

Example:
  berth-cli exec --server-id 1 --stack mystack --service web --command "ls -la /app"
  berth-cli exec -s 1 -n mystack --service web --container web-1 --command "env"`,
	RunE: runExecCommand,
}

func init() {
	rootCmd.AddCommand(execCmd)

	execCmd.Flags().StringVarP(&execServerID, "server-id", "s", "", "Server ID (required)")
	execCmd.Flags().StringVarP(&execStackName, "stack", "n", "", "Stack name (required)")
	execCmd.Flags().StringVar(&execServiceName, "service", "", "Service name (required)")
	execCmd.Flags().StringVar(&execContainerName, "container", "", "Container name (optional, defaults to service)")
	execCmd.Flags().StringVarP(&execCommand, "command", "c", "", "Command to execute (required)")

	execCmd.MarkFlagRequired("server-id")
	execCmd.MarkFlagRequired("stack")
	execCmd.MarkFlagRequired("service")
	execCmd.MarkFlagRequired("command")
}

type TerminalMessage struct {
	Type          string `json:"type"`
	StackName     string `json:"stack_name,omitempty"`
	ServiceName   string `json:"service_name,omitempty"`
	ContainerName string `json:"container_name,omitempty"`
	SessionID     string `json:"session_id,omitempty"`
	Input         []byte `json:"input,omitempty"`
	Output        []byte `json:"output,omitempty"`
	Cols          int    `json:"cols,omitempty"`
	Rows          int    `json:"rows,omitempty"`
	ExitCode      int    `json:"exit_code,omitempty"`
	Message       string `json:"message,omitempty"`
	Error         string `json:"error,omitempty"`
	Context       string `json:"context,omitempty"`
	Timestamp     string `json:"timestamp,omitempty"`
}

var ansiEscapeRegex = regexp.MustCompile(`\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07`)

func stripAnsiCodes(data []byte) []byte {
	return ansiEscapeRegex.ReplaceAll(data, []byte{})
}

func runExecCommand(cmd *cobra.Command, args []string) error {
	config, err := cli.LoadConfig(GetAPIKey(), GetServerURL(), GetInsecure())
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	client := cli.NewClient(config)
	defer client.Close()

	wsPath := fmt.Sprintf("/ws/api/servers/%s/terminal", execServerID)
	if err := client.ConnectToPath(wsPath); err != nil {
		return fmt.Errorf("failed to connect to terminal websocket: %w", err)
	}

	var (
		sessionID     string
		sessionReady  = make(chan bool)
		sessionClosed = make(chan int)
		errorChan     = make(chan error, 1)
		outputMutex   sync.Mutex
		commandSent   bool
	)

	client.OnMessage("", func(data []byte) {
		var msg TerminalMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}

		switch msg.Type {
		case "success":
			sessionID = msg.SessionID
			close(sessionReady)

		case "terminal_output":
			if len(msg.Output) > 0 {

				cleaned := stripAnsiCodes(msg.Output)

				if len(cleaned) == 0 {
					return
				}

				output := string(cleaned)
				if !commandSent {

					if strings.Contains(output, "Terminal Ready") ||
						strings.HasPrefix(output, "/app #") ||
						strings.HasPrefix(output, "echo 'Terminal Ready'") {
						return
					}
				} else {

					cmdToSkip := strings.TrimSuffix(execCommand, "\n")
					if strings.Contains(output, cmdToSkip) ||
						strings.HasPrefix(output, "/app #") ||
						strings.HasPrefix(output, "exit") {
						return
					}
				}

				outputMutex.Lock()
				os.Stdout.Write(cleaned)
				outputMutex.Unlock()
			}

		case "terminal_close":
			sessionClosed <- msg.ExitCode

		case "error":
			errorMsg := msg.Error
			if msg.Context != "" {
				errorMsg = fmt.Sprintf("%s: %s", errorMsg, msg.Context)
			}
			select {
			case errorChan <- fmt.Errorf("%s", errorMsg):
			default:
			}
		}
	})

	startMsg := TerminalMessage{
		Type:          "terminal_start",
		StackName:     execStackName,
		ServiceName:   execServiceName,
		ContainerName: execContainerName,
		Cols:          80,
		Rows:          24,
	}

	startData, err := json.Marshal(startMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal start message: %w", err)
	}

	if err := client.Send("", startData); err != nil {
		return fmt.Errorf("failed to send start message: %w", err)
	}

	select {
	case <-sessionReady:

	case err := <-errorChan:
		return fmt.Errorf("failed to start terminal session: %w", err)
	case <-time.After(10 * time.Second):
		return fmt.Errorf("timeout waiting for terminal session to start")
	}

	time.Sleep(200 * time.Millisecond)

	command := execCommand
	if !strings.HasSuffix(command, "\n") {
		command += "\n"
	}

	inputMsg := TerminalMessage{
		Type:      "terminal_input",
		SessionID: sessionID,
		Input:     []byte(command),
	}

	inputData, err := json.Marshal(inputMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal input message: %w", err)
	}

	if err := client.Send("", inputData); err != nil {
		return fmt.Errorf("failed to send command: %w", err)
	}

	commandSent = true

	time.Sleep(100 * time.Millisecond)

	exitMsg := TerminalMessage{
		Type:      "terminal_input",
		SessionID: sessionID,
		Input:     []byte("exit\n"),
	}

	exitData, err := json.Marshal(exitMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal exit message: %w", err)
	}

	if err := client.Send("", exitData); err != nil {
		return fmt.Errorf("failed to send exit command: %w", err)
	}

	select {
	case exitCode := <-sessionClosed:

		time.Sleep(200 * time.Millisecond)
		os.Exit(exitCode)
	case err := <-errorChan:
		return err
	case <-time.After(30 * time.Second):
		return fmt.Errorf("timeout waiting for command to complete")
	}

	return nil
}
