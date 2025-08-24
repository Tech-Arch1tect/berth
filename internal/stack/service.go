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
