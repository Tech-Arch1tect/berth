package maintenance

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type Service struct {
	agentSvc  *agent.Service
	serverSvc *server.Service
	rbacSvc   *rbac.Service
	logger    *logging.Service
}

func NewService(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
		logger:    logger,
	}
}

func (s *Service) GetSystemInfo(ctx context.Context, userID uint, serverID uint) (*MaintenanceInfo, error) {
	s.logger.Debug("retrieving Docker system information",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
	)

	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.read")
	if err != nil {
		s.logger.Error("failed to check system info permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("system info access denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("insufficient permissions to view Docker system information")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for system info",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", "/maintenance/info", nil)
	if err != nil {
		s.logger.Error("failed to retrieve system info from agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("failed to request system info from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		s.logger.Warn("agent returned error for system info",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(bodyBytes)),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("agent returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var info MaintenanceInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		s.logger.Error("failed to decode system info response",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to decode system info response: %w", err)
	}

	s.logger.Debug("system information retrieved successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
	)

	return &info, nil
}

func (s *Service) PruneDocker(ctx context.Context, userID uint, serverID uint, request *PruneRequest) (*PruneResult, error) {
	s.logger.Info("Docker prune operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("prune_type", request.Type),
		zap.Bool("force", request.Force),
		zap.Bool("all", request.All),
	)

	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.write")
	if err != nil {
		s.logger.Error("failed to check Docker prune permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("Docker prune permission denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("insufficient permissions to perform Docker maintenance operations")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for Docker prune",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", "/maintenance/prune", request)
	if err != nil {
		s.logger.Error("failed to execute Docker prune via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("failed to request Docker prune from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result PruneResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		s.logger.Error("failed to decode Docker prune response",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to decode prune response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("Docker prune operation failed",
			zap.Int("status_code", resp.StatusCode),
			zap.Uint("server_id", serverID),
		)
		return &result, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	s.logger.Info("Docker prune operation completed successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("prune_type", request.Type),
		zap.Bool("force", request.Force),
		zap.Bool("all", request.All),
	)

	return &result, nil
}

func (s *Service) DeleteResource(ctx context.Context, userID uint, serverID uint, request *DeleteRequest) (*DeleteResult, error) {
	s.logger.Info("Docker resource deletion initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("resource_type", request.Type),
		zap.String("resource_id", request.ID),
	)

	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.write")
	if err != nil {
		s.logger.Error("failed to check Docker resource deletion permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("Docker resource deletion permission denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("resource_type", request.Type),
			zap.String("resource_id", request.ID),
		)
		return nil, fmt.Errorf("insufficient permissions to delete Docker resources")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for resource deletion",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "DELETE", "/maintenance/resource", request)
	if err != nil {
		s.logger.Error("failed to delete Docker resource via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
			zap.String("resource_type", request.Type),
			zap.String("resource_id", request.ID),
		)
		return nil, fmt.Errorf("failed to delete resource from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result DeleteResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		s.logger.Error("failed to decode resource deletion response",
			zap.Error(err),
			zap.String("resource_type", request.Type),
			zap.String("resource_id", request.ID),
		)
		return nil, fmt.Errorf("failed to decode delete response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("Docker resource deletion failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("resource_type", request.Type),
			zap.String("resource_id", request.ID),
		)
		return &result, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	s.logger.Info("Docker resource deleted successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("resource_type", request.Type),
		zap.String("resource_id", request.ID),
	)

	return &result, nil
}
