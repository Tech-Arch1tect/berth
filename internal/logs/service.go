package logs

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Service struct {
	agentSvc  *agent.Service
	serverSvc *server.Service
	rbacSvc   *rbac.Service
}

func NewService(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
	}
}

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
	Source    string    `json:"source"`
	Level     string    `json:"level,omitempty"`
}

type LogRequest struct {
	UserID        uint
	ServerID      uint
	StackName     string
	ServiceName   string
	ContainerName string
	Tail          int
	Since         string
	Timestamps    bool
}

type LogsResponse struct {
	Logs []LogEntry `json:"logs"`
}

func (s *Service) GetStackLogs(ctx context.Context, req LogRequest) (*LogsResponse, error) {
	if err := s.validateAccess(req.UserID, req.ServerID, req.StackName); err != nil {
		return nil, err
	}

	server, err := s.serverSvc.GetServer(req.ServerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/logs", url.PathEscape(req.StackName))
	return s.makeLogRequest(ctx, server, endpoint, req)
}

func (s *Service) GetContainerLogs(ctx context.Context, req LogRequest) (*LogsResponse, error) {
	if err := s.validateAccess(req.UserID, req.ServerID, req.StackName); err != nil {
		return nil, fmt.Errorf("access validation failed: %w", err)
	}

	if req.ContainerName == "" {
		return nil, fmt.Errorf("container name is required")
	}

	server, err := s.serverSvc.GetServer(req.ServerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/containers/%s/logs",
		url.PathEscape(req.StackName),
		url.PathEscape(req.ContainerName))
	return s.makeLogRequest(ctx, server, endpoint, req)
}

func (s *Service) validateAccess(userID, serverID uint, stackname string) error {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "logs.read")
	if err != nil {
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("insufficient permissions to view logs for stack '%s'", stackname)
	}

	return nil
}

func (s *Service) makeLogRequest(ctx context.Context, serverModel *models.Server, endpoint string, req LogRequest) (*LogsResponse, error) {
	params := url.Values{}

	if req.Tail > 0 {
		params.Set("tail", strconv.Itoa(req.Tail))
	}

	if req.Since != "" {
		params.Set("since", req.Since)
	}

	params.Set("timestamps", strconv.FormatBool(req.Timestamps))

	fullEndpoint := endpoint
	if len(params) > 0 {
		fullEndpoint += "?" + params.Encode()
	}

	resp, err := s.agentSvc.MakeRequest(ctx, serverModel, "GET", fullEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var logsResponse LogsResponse
	if err := json.NewDecoder(resp.Body).Decode(&logsResponse); err != nil {
		return nil, fmt.Errorf("failed to decode logs response: %w", err)
	}

	return &logsResponse, nil
}
