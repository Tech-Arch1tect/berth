package commands

import (
	"berth/internal/cli"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var (
	dockerServerID string
	stackName      string
	services       []string
	options        []string
	follow         bool
)

var dockerCmd = &cobra.Command{
	Use:   "docker",
	Short: "Docker operations on stacks or individual services",
	Long:  `Execute Docker operations like up, down, start, stop, restart, pull on stacks or individual services.`,
}

var upCmd = &cobra.Command{
	Use:   "up",
	Short: "Start a stack or specific services",
	Long:  `Start a Docker stack or specific services using 'docker compose up'. Use --services to target specific services.`,
	RunE:  runDockerOperation("up"),
}

var downCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop a stack or specific services",
	Long:  `Stop a Docker stack or specific services using 'docker compose down'. Use --services to target specific services.`,
	RunE:  runDockerOperation("down"),
}

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start services",
	Long:  `Start Docker services using 'docker compose start'. Use --services to target specific services, or omit to start all.`,
	RunE:  runDockerOperation("start"),
}

var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop services",
	Long:  `Stop Docker services using 'docker compose stop'. Use --services to target specific services, or omit to stop all.`,
	RunE:  runDockerOperation("stop"),
}

var restartCmd = &cobra.Command{
	Use:   "restart",
	Short: "Restart services",
	Long:  `Restart Docker services using 'docker compose restart'. Use --services to target specific services, or omit to restart all.`,
	RunE:  runDockerOperation("restart"),
}

var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Pull images",
	Long:  `Pull Docker images using 'docker compose pull'. Use --services to target specific services, or omit to pull all.`,
	RunE:  runDockerOperation("pull"),
}

func init() {

	rootCmd.AddCommand(dockerCmd)

	dockerCmd.AddCommand(upCmd, downCmd, startCmd, stopCmd, restartCmd, pullCmd)

	dockerCmd.PersistentFlags().StringVarP(&dockerServerID, "server-id", "s", "", "Server ID (required)")
	dockerCmd.PersistentFlags().StringVarP(&stackName, "stack", "n", "", "Stack name (required)")
	dockerCmd.PersistentFlags().StringSliceVarP(&services, "services", "", []string{}, "Specific services to target (comma-separated). Omit to target all services in the stack.")
	dockerCmd.PersistentFlags().StringSliceVarP(&options, "options", "o", []string{}, "Additional options to pass to docker compose")
	dockerCmd.PersistentFlags().BoolVarP(&follow, "follow", "f", true, "Follow operation logs (default: true)")

	dockerCmd.MarkPersistentFlagRequired("server-id")
	dockerCmd.MarkPersistentFlagRequired("stack")
}

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

func runDockerOperation(command string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		config, err := cli.LoadConfig(GetAPIKey(), GetServerURL(), GetInsecure())
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		req := OperationRequest{
			Command:  command,
			Options:  options,
			Services: services,
		}

		operationID, err := startOperation(config, dockerServerID, stackName, req)
		if err != nil {
			return fmt.Errorf("failed to start operation: %w", err)
		}

		fmt.Printf("Operation started: %s\n", operationID)

		if !follow {
			return nil
		}

		return streamOperation(config, dockerServerID, stackName, operationID)
	}
}

func startOperation(config *cli.Config, serverID, stackName string, req OperationRequest) (string, error) {
	url := fmt.Sprintf("%s/api/v1/servers/%s/stacks/%s/operations", config.ServerURL, serverID, stackName)

	reqBody, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, strings.NewReader(string(reqBody)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+config.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	if config.Insecure {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("operation failed: %s - %s", resp.Status, string(body))
	}

	var operationResp OperationResponse
	if err := json.NewDecoder(resp.Body).Decode(&operationResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return operationResp.OperationID, nil
}

func streamOperation(config *cli.Config, serverID, stackName, operationID string) error {

	client := cli.NewClient(config)

	wsPath := fmt.Sprintf("/ws/api/servers/%s/stacks/%s/operations/%s", serverID, stackName, operationID)
	if err := client.ConnectToPath(wsPath); err != nil {
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}
	defer client.Close()

	handleStreamMessage := func(data []byte) {
		var msg StreamMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			fmt.Printf("Error parsing message: %v\n", err)
			return
		}

		switch msg.Type {
		case "stdout", "stderr":
			if len(msg.Data) > 0 && msg.Data[len(msg.Data)-1] != '\n' {
				fmt.Println(msg.Data)
			} else {
				fmt.Print(msg.Data)
			}
		case "progress":
			fmt.Printf("[%s] %s\n", msg.Timestamp.Format("15:04:05"), msg.Data)
		case "complete":
			success := msg.Success != nil && *msg.Success
			exitCode := 0
			if msg.ExitCode != nil {
				exitCode = *msg.ExitCode
			}

			if success {
				fmt.Printf("\nOperation completed successfully (exit code: %d)\n", exitCode)
				os.Exit(exitCode)
			} else {
				fmt.Printf("\nOperation failed (exit code: %d)\n", exitCode)
				os.Exit(exitCode)
			}
		case "error":
			fmt.Printf("Error: %s\n", msg.Data)
			os.Exit(1)
		}
	}

	client.OnMessage("stdout", handleStreamMessage)
	client.OnMessage("stderr", handleStreamMessage)
	client.OnMessage("progress", handleStreamMessage)
	client.OnMessage("complete", handleStreamMessage)
	client.OnMessage("error", handleStreamMessage)

	select {}
}
