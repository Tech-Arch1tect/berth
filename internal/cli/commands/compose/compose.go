package compose

import (
	"berth/internal/cli"
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var ComposeCmd = &cobra.Command{
	Use:   "compose",
	Short: "Manage Docker Compose configurations",
	Long:  `Commands for viewing and modifying Docker Compose stack configurations.`,
}

type UpdateResult struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	OriginalYAML string `json:"original_yaml,omitempty"`
	ModifiedYAML string `json:"modified_yaml,omitempty"`
}

func loadConfigFromCmd(cmd *cobra.Command) (*cli.Config, error) {
	apiKey, _ := cmd.Root().PersistentFlags().GetString("api-key")
	serverURL, _ := cmd.Root().PersistentFlags().GetString("server")
	insecure, _ := cmd.Root().PersistentFlags().GetBool("insecure")
	return cli.LoadConfig(apiKey, serverURL, insecure)
}

func httpClient(insecure bool) *http.Client {
	client := &http.Client{Timeout: 30 * time.Second}
	if insecure {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	return client
}

func getComposeConfig(cmd *cobra.Command, serverID, stackName string) (map[string]any, error) {
	config, err := loadConfigFromCmd(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/servers/%s/stacks/%s/compose", config.ServerURL, serverID, stackName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := httpClient(config.Insecure).Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

func updateComposeConfig(cmd *cobra.Command, serverID, stackName string, changes map[string]any, preview bool) (*UpdateResult, error) {
	config, err := loadConfigFromCmd(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	payload := map[string]any{
		"changes": changes,
		"preview": preview,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/servers/%s/stacks/%s/compose", config.ServerURL, serverID, stackName)

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+config.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient(config.Insecure).Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]any
		if json.Unmarshal(body, &errResp) == nil {
			if msg, ok := errResp["error"].(string); ok {
				return nil, fmt.Errorf("API error: %s", msg)
			}
		}
		return nil, fmt.Errorf("request failed: %s - %s", resp.Status, string(body))
	}

	var result UpdateResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func displayDiff(original, modified string) {
	fmt.Println("\n--- Original")
	fmt.Println("+++ Modified")
	fmt.Println()
	fmt.Println("Original:")
	fmt.Println(original)
	fmt.Println()
	fmt.Println("Modified:")
	fmt.Println(modified)
}

func confirmApply() bool {
	fmt.Print("\nApply these changes? [y/N]: ")
	var response string
	fmt.Scanln(&response)
	return response == "y" || response == "Y"
}

func formatJSON(data any) (string, error) {
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func printError(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "Error: "+format+"\n", args...)
}
