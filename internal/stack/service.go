package stack

import (
	"brx-starter-kit/internal/agent"
	"brx-starter-kit/internal/rbac"
	"brx-starter-kit/internal/server"
	"brx-starter-kit/models"
	"context"
	"encoding/json"
	"fmt"
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

func (s *Service) GetServerInfo(serverID uint) (*models.ServerResponse, error) {
	return s.serverSvc.GetServerResponse(serverID)
}

func (s *Service) ListStacksForServer(ctx context.Context, userID uint, serverID uint) ([]Stack, error) {
	hasPermission, err := s.rbacSvc.UserHasServerPermission(userID, serverID, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this server")
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	stacks, err := s.fetchStacksFromAgent(ctx, server)
	if err != nil {
		return nil, err
	}

	for i := range stacks {
		stacks[i].ServerID = server.ID
		stacks[i].ServerName = server.Name
	}

	return stacks, nil
}

func (s *Service) GetStackDetails(ctx context.Context, userID uint, serverID uint, stackName string) (*StackDetails, error) {
	hasPermission, err := s.rbacSvc.UserHasServerPermission(userID, serverID, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this server")
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	stackDetails, err := s.fetchStackDetailsFromAgent(ctx, server, stackName)
	if err != nil {
		return nil, err
	}

	stackDetails.ServerID = server.ID
	stackDetails.ServerName = server.Name

	return stackDetails, nil
}

func (s *Service) fetchStacksFromAgent(ctx context.Context, server *models.Server) ([]Stack, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", "/stacks", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var stacks []Stack
	if err := json.NewDecoder(resp.Body).Decode(&stacks); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return stacks, nil
}

func (s *Service) fetchStackDetailsFromAgent(ctx context.Context, server *models.Server, stackName string) (*StackDetails, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s", stackName), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var stackDetails StackDetails
	if err := json.NewDecoder(resp.Body).Decode(&stackDetails); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &stackDetails, nil
}

func (s *Service) GetStackNetworks(ctx context.Context, userID uint, serverID uint, stackName string) ([]Network, error) {
	hasPermission, err := s.rbacSvc.UserHasServerPermission(userID, serverID, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this server")
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	networks, err := s.fetchStackNetworksFromAgent(ctx, server, stackName)
	if err != nil {
		return nil, err
	}

	return networks, nil
}

func (s *Service) fetchStackNetworksFromAgent(ctx context.Context, server *models.Server, stackName string) ([]Network, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/networks", stackName), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var networks []Network
	if err := json.NewDecoder(resp.Body).Decode(&networks); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return networks, nil
}

func (s *Service) GetStackVolumes(ctx context.Context, userID uint, serverID uint, stackName string) ([]Volume, error) {
	hasPermission, err := s.rbacSvc.UserHasServerPermission(userID, serverID, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this server")
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	volumes, err := s.fetchStackVolumesFromAgent(ctx, server, stackName)
	if err != nil {
		return nil, err
	}

	return volumes, nil
}

func (s *Service) fetchStackVolumesFromAgent(ctx context.Context, server *models.Server, stackName string) ([]Volume, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/volumes", stackName), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var volumes []Volume
	if err := json.NewDecoder(resp.Body).Decode(&volumes); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return volumes, nil
}

func (s *Service) GetStackEnvironmentVariables(ctx context.Context, userID uint, serverID uint, stackName string) (map[string][]ServiceEnvironment, error) {
	hasPermission, err := s.rbacSvc.UserHasServerPermission(userID, serverID, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this server")
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	environmentVariables, err := s.fetchStackEnvironmentVariablesFromAgent(ctx, server, stackName)
	if err != nil {
		return nil, err
	}

	return environmentVariables, nil
}

func (s *Service) fetchStackEnvironmentVariablesFromAgent(ctx context.Context, server *models.Server, stackName string) (map[string][]ServiceEnvironment, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/environment", stackName), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var environmentVariables map[string][]ServiceEnvironment
	if err := json.NewDecoder(resp.Body).Decode(&environmentVariables); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return environmentVariables, nil
}
