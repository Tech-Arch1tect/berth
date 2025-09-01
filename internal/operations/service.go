package operations

import (
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/models"
	"bufio"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Service struct {
	serverSvc *server.Service
	rbacSvc   *rbac.Service
}

func NewService(serverSvc *server.Service, rbacSvc *rbac.Service) *Service {
	return &Service{
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
	}
}

func (s *Service) StartOperation(ctx context.Context, userID uint, serverID uint, stackname string, req OperationRequest) (*OperationResponse, error) {

	serverModel, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "stacks.manage")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions to manage stack '%s' on server %d", stackname, serverID)
	}

	endpoint := fmt.Sprintf("/api/stacks/%s/operations", url.PathEscape(stackname))

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	agentResp, err := s.makeAgentRequest(ctx, serverModel, "POST", endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to start operation on agent: %w", err)
	}
	defer func() { _ = agentResp.Body.Close() }()

	if agentResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned error: %s", agentResp.Status)
	}

	var response OperationResponse
	if err := json.NewDecoder(agentResp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &response, nil
}

func (s *Service) StreamOperationToWriter(ctx context.Context, userID uint, serverID uint, stackname string, operationID string, writer io.Writer) error {

	serverModel, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "stacks.manage")
	if err != nil {
		return fmt.Errorf("failed to check permissions: %w", err)
	}
	if !hasPermission {
		return fmt.Errorf("insufficient permissions to access stack '%s' on server %d", stackname, serverID)
	}

	endpoint := fmt.Sprintf("/api/operations/%s/stream", url.PathEscape(operationID))

	agentResp, err := s.makeAgentRequest(ctx, serverModel, "GET", endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to agent stream: %w", err)
	}
	defer func() { _ = agentResp.Body.Close() }()

	if agentResp.StatusCode != http.StatusOK {
		return fmt.Errorf("agent returned error: %s", agentResp.Status)
	}

	return s.relaySSEStream(ctx, agentResp.Body, writer)
}

func (s *Service) relaySSEStream(ctx context.Context, reader io.Reader, writer io.Writer) error {
	scanner := bufio.NewScanner(reader)

	for {

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				return err
			}
			break
		}

		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			if _, err := writer.Write([]byte(line + "\n\n")); err != nil {
				return fmt.Errorf("failed to write to output stream: %w", err)
			}

			if flusher, ok := writer.(http.Flusher); ok {
				flusher.Flush()
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}

	return nil
}

func (s *Service) makeAgentRequest(ctx context.Context, serverModel *models.Server, method, endpoint string, body []byte) (*http.Response, error) {

	var client *http.Client
	if strings.Contains(endpoint, "/stream") {
		client = &http.Client{}
	} else {
		client = &http.Client{
			Timeout: 30 * time.Second,
		}
	}

	if serverModel.SkipSSLVerification != nil && *serverModel.SkipSSLVerification {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		}
	}

	agentURL := fmt.Sprintf("https://%s:%d%s", serverModel.Host, serverModel.Port, endpoint)

	var bodyReader io.Reader
	if body != nil {
		bodyReader = strings.NewReader(string(body))
	}

	req, err := http.NewRequestWithContext(ctx, method, agentURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if serverModel.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+serverModel.AccessToken)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if strings.Contains(endpoint, "/stream") {
		req.Header.Set("Accept", "text/event-stream")
		req.Header.Set("Cache-Control", "no-cache")
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
