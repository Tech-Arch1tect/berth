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

func (s *Service) GetSystemInfo(ctx context.Context, userID uint, serverID uint) (*MaintenanceInfo, error) {
	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions to view Docker system information")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", "/maintenance/info", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to request system info from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("agent returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var info MaintenanceInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("failed to decode system info response: %w", err)
	}

	return &info, nil
}

func (s *Service) PruneDocker(ctx context.Context, userID uint, serverID uint, request *PruneRequest) (*PruneResult, error) {
	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.write")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions to perform Docker maintenance operations")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", "/maintenance/prune", request)
	if err != nil {
		return nil, fmt.Errorf("failed to request Docker prune from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result PruneResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode prune response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return &result, nil
}

func (s *Service) DeleteResource(ctx context.Context, userID uint, serverID uint, request *DeleteRequest) (*DeleteResult, error) {
	hasPermission, err := s.rbacSvc.UserHasAnyStackPermission(userID, serverID, "docker.maintenance.write")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("insufficient permissions to delete Docker resources")
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "DELETE", "/maintenance/resource", request)
	if err != nil {
		return nil, fmt.Errorf("failed to delete resource from agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result DeleteResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode delete response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return &result, nil
}
