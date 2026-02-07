package logs

import (
	"berth/internal/rbac"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type logsAgentClient interface {
	MakeRequest(ctx context.Context, server *models.Server, method, endpoint string, payload any) (*http.Response, error)
}

type logsServerProvider interface {
	GetActiveServerForUser(ctx context.Context, id, userID uint) (*models.Server, error)
}

type logsPermissionChecker interface {
	UserHasStackPermission(ctx context.Context, userID, serverID uint, stackname, permissionName string) (bool, error)
}

type Service struct {
	agentSvc  logsAgentClient
	serverSvc logsServerProvider
	rbacSvc   logsPermissionChecker
	logger    *logging.Service
}

func NewService(agentSvc logsAgentClient, serverSvc logsServerProvider, rbacSvc logsPermissionChecker, logger *logging.Service) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
		logger:    logger,
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
	ContainerName string
	Tail          int
	Since         string
	Timestamps    bool
}

type LogsData struct {
	Logs []LogEntry `json:"logs"`
}

type LogsResponse struct {
	Success bool     `json:"success"`
	Data    LogsData `json:"data"`
}

func (s *Service) GetStackLogs(ctx context.Context, req LogRequest) (*LogsData, error) {
	s.logger.Debug("retrieving stack logs",
		zap.Uint("user_id", req.UserID),
		zap.Uint("server_id", req.ServerID),
		zap.String("stack_name", req.StackName),
		zap.Int("tail", req.Tail),
		zap.String("since", req.Since),
	)

	if err := s.validateAccess(ctx, req.UserID, req.ServerID, req.StackName); err != nil {
		s.logger.Warn("stack logs access denied",
			zap.Error(err),
			zap.Uint("user_id", req.UserID),
			zap.String("stack_name", req.StackName),
		)
		return nil, err
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, req.ServerID, req.UserID)
	if err != nil {
		s.logger.Error("failed to get server for stack logs",
			zap.Error(err),
			zap.Uint("server_id", req.ServerID),
			zap.Uint("user_id", req.UserID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/logs", url.PathEscape(req.StackName))
	response, err := s.makeLogRequest(ctx, server, endpoint, req)
	if err != nil {
		s.logger.Error("failed to retrieve stack logs",
			zap.Error(err),
			zap.String("stack_name", req.StackName),
		)
		return nil, err
	}

	s.logger.Info("stack logs retrieved successfully",
		zap.Uint("user_id", req.UserID),
		zap.String("stack_name", req.StackName),
		zap.Int("log_count", len(response.Logs)),
	)

	return response, nil
}

func (s *Service) GetContainerLogs(ctx context.Context, req LogRequest) (*LogsData, error) {
	s.logger.Debug("retrieving container logs",
		zap.Uint("user_id", req.UserID),
		zap.Uint("server_id", req.ServerID),
		zap.String("stack_name", req.StackName),
		zap.String("container_name", req.ContainerName),
		zap.Int("tail", req.Tail),
	)

	if err := s.validateAccess(ctx, req.UserID, req.ServerID, req.StackName); err != nil {
		s.logger.Warn("container logs access denied",
			zap.Error(err),
			zap.Uint("user_id", req.UserID),
			zap.String("stack_name", req.StackName),
			zap.String("container_name", req.ContainerName),
		)
		return nil, fmt.Errorf("access validation failed: %w", err)
	}

	if req.ContainerName == "" {
		s.logger.Warn("container logs request missing container name",
			zap.Uint("user_id", req.UserID),
			zap.String("stack_name", req.StackName),
		)
		return nil, fmt.Errorf("container name is required")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, req.ServerID, req.UserID)
	if err != nil {
		s.logger.Error("failed to get server for container logs",
			zap.Error(err),
			zap.Uint("server_id", req.ServerID),
			zap.Uint("user_id", req.UserID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/containers/%s/logs",
		url.PathEscape(req.StackName),
		url.PathEscape(req.ContainerName))
	response, err := s.makeLogRequest(ctx, server, endpoint, req)
	if err != nil {
		s.logger.Error("failed to retrieve container logs",
			zap.Error(err),
			zap.String("stack_name", req.StackName),
			zap.String("container_name", req.ContainerName),
		)
		return nil, err
	}

	s.logger.Info("container logs retrieved successfully",
		zap.Uint("user_id", req.UserID),
		zap.String("stack_name", req.StackName),
		zap.String("container_name", req.ContainerName),
		zap.Int("log_count", len(response.Logs)),
	)

	return response, nil
}

func (s *Service) validateAccess(ctx context.Context, userID, serverID uint, stackname string) error {
	s.logger.Debug("validating logs access",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, rbac.PermLogsRead)
	if err != nil {
		s.logger.Error("failed to check logs permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user lacks logs permission",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("insufficient permissions to view logs for stack '%s'", stackname)
	}

	return nil
}

func (s *Service) makeLogRequest(ctx context.Context, serverModel *models.Server, endpoint string, req LogRequest) (*LogsData, error) {
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

	s.logger.Debug("making logs request to agent",
		zap.String("endpoint", fullEndpoint),
		zap.Uint("server_id", serverModel.ID),
		zap.String("server_name", serverModel.Name),
	)

	resp, err := s.agentSvc.MakeRequest(ctx, serverModel, "GET", fullEndpoint, nil)
	if err != nil {
		s.logger.Error("failed to get logs from agent",
			zap.Error(err),
			zap.String("endpoint", fullEndpoint),
			zap.Uint("server_id", serverModel.ID),
		)
		return nil, fmt.Errorf("failed to get logs from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for logs request",
			zap.Int("status_code", resp.StatusCode),
			zap.String("endpoint", fullEndpoint),
		)
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var logsData LogsData
	if err := json.NewDecoder(resp.Body).Decode(&logsData); err != nil {
		s.logger.Error("failed to decode logs response",
			zap.Error(err),
			zap.String("endpoint", fullEndpoint),
		)
		return nil, fmt.Errorf("failed to decode logs response: %w", err)
	}

	s.logger.Debug("logs response decoded successfully",
		zap.String("endpoint", fullEndpoint),
		zap.Int("log_entries", len(logsData.Logs)),
	)

	return &logsData, nil
}
