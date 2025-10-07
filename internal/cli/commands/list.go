package commands

import (
	"berth/internal/cli"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List servers and stacks",
	Long:  `List available servers and their stacks.`,
}

var serversCmd = &cobra.Command{
	Use:   "servers",
	Short: "List servers",
	Long:  `List all accessible servers.`,
	RunE:  listServers,
}

var stacksCmd = &cobra.Command{
	Use:   "stacks [server-id]",
	Short: "List stacks on a server",
	Long:  `List all stacks on a specific server.`,
	Args:  cobra.ExactArgs(1),
	RunE:  listStacks,
}

func init() {
	rootCmd.AddCommand(listCmd)
	listCmd.AddCommand(serversCmd, stacksCmd)
}

type Server struct {
	ID                  uint      `json:"id"`
	Name                string    `json:"name"`
	Host                string    `json:"host"`
	Port                int       `json:"port"`
	IsActive            bool      `json:"is_active"`
	SkipSSLVerification bool      `json:"skip_ssl_verification"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type ServersResponse struct {
	Servers []Server `json:"servers"`
}

type Stack struct {
	Name              string `json:"name"`
	Path              string `json:"path"`
	ComposeFile       string `json:"compose_file"`
	ServerID          int    `json:"server_id"`
	ServerName        string `json:"server_name"`
	IsHealthy         bool   `json:"is_healthy"`
	TotalContainers   int    `json:"total_containers"`
	RunningContainers int    `json:"running_containers"`
}

type StacksResponse struct {
	Stacks []Stack `json:"stacks"`
}

func listServers(cmd *cobra.Command, args []string) error {
	config, err := cli.LoadConfig(GetAPIKey(), GetServerURL(), GetInsecure())
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/servers", config.ServerURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	if config.Insecure {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	var response ServersResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	servers := response.Servers

	if len(servers) == 0 {
		fmt.Println("No servers found.")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tName\tHost\tPort\tActive\tSSL Skip")
	fmt.Fprintln(w, "--\t----\t----\t----\t------\t--------")

	for _, server := range servers {
		status := "No"
		if server.IsActive {
			status = "Yes"
		}
		sslSkip := "No"
		if server.SkipSSLVerification {
			sslSkip = "Yes"
		}
		fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\t%s\n",
			server.ID,
			server.Name,
			server.Host,
			server.Port,
			status,
			sslSkip,
		)
	}

	return w.Flush()
}

func listStacks(cmd *cobra.Command, args []string) error {
	serverID := args[0]

	config, err := cli.LoadConfig(GetAPIKey(), GetServerURL(), GetInsecure())
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/servers/%s/stacks", config.ServerURL, serverID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	if config.Insecure {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	var response StacksResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	stacks := response.Stacks

	if len(stacks) == 0 {
		fmt.Printf("No stacks found on server %s.\n", serverID)
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "Name\tHealthy\tTotal\tRunning\tCompose File")
	fmt.Fprintln(w, "----\t-------\t-----\t-------\t------------")

	for _, stack := range stacks {
		healthy := "No"
		if stack.IsHealthy {
			healthy = "Yes"
		}
		fmt.Fprintf(w, "%s\t%s\t%d\t%d\t%s\n",
			stack.Name,
			healthy,
			stack.TotalContainers,
			stack.RunningContainers,
			stack.ComposeFile,
		)
	}

	return w.Flush()
}
