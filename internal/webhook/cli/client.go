package cli

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	httpClient *http.Client
	baseURL    string
	verbose    bool
}

func NewClient(baseURL string, insecure bool, verbose bool) *Client {
	transport := &http.Transport{}
	if insecure {
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}

	return &Client{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   35 * time.Minute,
		},
		baseURL: baseURL,
		verbose: verbose,
	}
}

type TriggerRequest struct {
	APIKey    string   `json:"api_key"`
	ServerID  uint     `json:"server_id"`
	StackName string   `json:"stack_name"`
	Command   string   `json:"command"`
	Options   []string `json:"options,omitempty"`
	Services  []string `json:"services,omitempty"`
}

type TriggerResponse struct {
	OperationID        string  `json:"operation_id"`
	Status             string  `json:"status"`
	Success            bool    `json:"success"`
	ExitCode           int     `json:"exit_code"`
	DurationMS         *int    `json:"duration_ms"`
	PositionInQueue    int     `json:"position_in_queue"`
	EstimatedStartTime *string `json:"estimated_start_time"`
}

type StreamMessage struct {
	Type      string `json:"type"`
	Data      string `json:"data"`
	Timestamp string `json:"timestamp"`
	Success   *bool  `json:"success"`
	ExitCode  *int   `json:"exitCode"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func (c *Client) TriggerWebhook(webhookID uint, req TriggerRequest) (*TriggerResponse, error) {
	url := fmt.Sprintf("%s/api/v1/webhooks/%d/trigger", c.baseURL, webhookID)

	if c.verbose {
		fmt.Printf("POST %s\n", url)
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	if c.verbose {
		fmt.Printf("Request body: %s\n", string(body))
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if c.verbose {
		fmt.Printf("Response status: %d\n", resp.StatusCode)
		fmt.Printf("Response body: %s\n", string(respBody))
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("server error: %s", errResp.Error)
		}
		return nil, fmt.Errorf("server returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var triggerResp TriggerResponse
	if err := json.Unmarshal(respBody, &triggerResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &triggerResp, nil
}

func (c *Client) StreamOperationLogs(operationID string, apiKey string, outputCallback func(string)) (*StreamMessage, error) {
	url := fmt.Sprintf("%s/api/v1/operations/%s/stream", c.baseURL, operationID)

	if c.verbose {
		fmt.Printf("GET %s\n", url)
	}

	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Cache-Control", "no-cache")
	httpReq.Header.Set("X-API-Key", apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var lastMessage *StreamMessage

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			data := line[6:]

			var msg StreamMessage
			if err := json.Unmarshal([]byte(data), &msg); err != nil {
				continue
			}

			lastMessage = &msg

			if msg.Type == "stdout" || msg.Type == "stderr" {
				if outputCallback != nil {
					outputCallback(msg.Data)
				}
			}

			if msg.Type == "complete" {
				return lastMessage, nil
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("stream error: %w", err)
	}

	return lastMessage, nil
}
