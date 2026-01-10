package stack

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
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

func (s *Service) GetServerInfo(serverID uint) (*models.ServerResponse, error) {
	return s.serverSvc.GetServerResponse(serverID)
}

func (s *Service) ListStacksForServer(ctx context.Context, userID uint, serverID uint) ([]Stack, error) {
	s.logger.Debug("listing stacks for server",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
	)

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for stack listing",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	allStacks, err := s.fetchStacksFromAgent(ctx, server)
	if err != nil {
		s.logger.Error("failed to fetch stacks from agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
		)
		return nil, err
	}

	var accessibleStacks []Stack
	for _, stack := range allStacks {
		hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stack.Name, "stacks.read")
		if err != nil {
			s.logger.Warn("failed to check stack permission",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.String("stack_name", stack.Name),
			)
			continue
		}

		if hasPermission {
			stack.ServerID = server.ID
			stack.ServerName = server.Name
			accessibleStacks = append(accessibleStacks, stack)
		}
	}

	s.logger.Info("stacks listed for user",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.Int("total_stacks", len(allStacks)),
		zap.Int("accessible_stacks", len(accessibleStacks)),
	)

	return accessibleStacks, nil
}

func (s *Service) CreateStack(ctx context.Context, userID uint, serverID uint, name string) (*Stack, error) {
	s.logger.Debug("creating new stack",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", name),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, name, "stacks.create")
	if err != nil {
		s.logger.Error("failed to check create permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", name),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied create stack permission",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", name),
		)
		return nil, fmt.Errorf("permission denied: stacks.create required for pattern matching '%s'", name)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for stack creation",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	stack, err := s.createStackOnAgent(ctx, server, name)
	if err != nil {
		s.logger.Error("failed to create stack on agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
			zap.String("stack_name", name),
		)
		return nil, err
	}

	stack.ServerID = server.ID
	stack.ServerName = server.Name

	s.logger.Info("stack created successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", name),
	)

	return stack, nil
}

func (s *Service) createStackOnAgent(ctx context.Context, server *models.Server, name string) (*Stack, error) {
	s.logger.Debug("creating stack on agent",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", name),
	)

	reqBody := map[string]string{"name": name}
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", "/stacks", reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Error   string `json:"error"`
		Stack   *Stack `json:"stack"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated {
		if result.Error != "" {
			return nil, fmt.Errorf("agent error: %s", result.Error)
		}
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return result.Stack, nil
}

func (s *Service) GetStackDetails(ctx context.Context, userID uint, serverID uint, stackname string) (*StackDetails, error) {
	s.logger.Debug("getting stack details",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.read")
	if err != nil {
		s.logger.Error("failed to check stack permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack details",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for stack details",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	stackDetails, err := s.fetchStackDetailsFromAgent(ctx, server, stackname)
	if err != nil {
		s.logger.Error("failed to fetch stack details from agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
			zap.String("stack_name", stackname),
		)
		return nil, err
	}

	stackDetails.ServerID = server.ID
	stackDetails.ServerName = server.Name

	s.logger.Info("stack details retrieved",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", stackname),
	)

	return stackDetails, nil
}

func (s *Service) fetchStacksFromAgent(ctx context.Context, server *models.Server) ([]Stack, error) {
	s.logger.Debug("fetching stacks from agent",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", "/stacks", nil)
	if err != nil {
		s.logger.Error("failed to communicate with agent for stacks",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for stacks request",
			zap.Int("status_code", resp.StatusCode),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var stacks []Stack
	if err := json.NewDecoder(resp.Body).Decode(&stacks); err != nil {
		s.logger.Error("failed to decode stacks response from agent",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
		)
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	s.logger.Debug("stacks fetched from agent",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.Int("stack_count", len(stacks)),
	)

	return stacks, nil
}

func (s *Service) fetchStackDetailsFromAgent(ctx context.Context, server *models.Server, stackname string) (*StackDetails, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var stackDetails StackDetails
	if err := json.NewDecoder(resp.Body).Decode(&stackDetails); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &stackDetails, nil
}

func (s *Service) GetStackNetworks(ctx context.Context, userID uint, serverID uint, stackname string) ([]Network, error) {
	s.logger.Debug("getting stack networks",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.read")
	if err != nil {
		s.logger.Error("failed to check permission for stack networks",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack networks",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for stack networks",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	networks, err := s.fetchStackNetworksFromAgent(ctx, server, stackname)
	if err != nil {
		s.logger.Error("failed to fetch stack networks from agent",
			zap.Error(err),
			zap.String("stack_name", stackname),
		)
		return nil, err
	}

	s.logger.Debug("stack networks retrieved",
		zap.Uint("user_id", userID),
		zap.String("stack_name", stackname),
		zap.Int("network_count", len(networks)),
	)

	return networks, nil
}

func (s *Service) fetchStackNetworksFromAgent(ctx context.Context, server *models.Server, stackname string) ([]Network, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/networks", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var networks []Network
	if err := json.NewDecoder(resp.Body).Decode(&networks); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return networks, nil
}

func (s *Service) GetStackVolumes(ctx context.Context, userID uint, serverID uint, stackname string) ([]Volume, error) {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	volumes, err := s.fetchStackVolumesFromAgent(ctx, server, stackname)
	if err != nil {
		return nil, err
	}

	return volumes, nil
}

func (s *Service) GetContainerImageDetails(ctx context.Context, userID uint, serverID uint, stackname string) ([]ContainerImageDetails, error) {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	imageDetails, err := s.fetchContainerImageDetailsFromAgent(ctx, server, stackname)
	if err != nil {
		return nil, err
	}

	return imageDetails, nil
}

func (s *Service) fetchStackVolumesFromAgent(ctx context.Context, server *models.Server, stackname string) ([]Volume, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/volumes", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var volumes []Volume
	if err := json.NewDecoder(resp.Body).Decode(&volumes); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return volumes, nil
}

func (s *Service) GetStackEnvironmentVariables(ctx context.Context, userID uint, serverID uint, stackname string, unmask bool) (map[string][]ServiceEnvironment, error) {
	requiredPermission := "stacks.read"
	if unmask {
		requiredPermission = "stacks.manage"
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, requiredPermission)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	environmentVariables, err := s.fetchStackEnvironmentVariablesFromAgent(ctx, server, stackname, unmask)
	if err != nil {
		return nil, err
	}

	return environmentVariables, nil
}

func (s *Service) fetchStackEnvironmentVariablesFromAgent(ctx context.Context, server *models.Server, stackname string, unmask bool) (map[string][]ServiceEnvironment, error) {
	url := fmt.Sprintf("/stacks/%s/environment", stackname)
	if unmask {
		url += "?unmask=true"
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var environmentVariables map[string][]ServiceEnvironment
	if err := json.NewDecoder(resp.Body).Decode(&environmentVariables); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return environmentVariables, nil
}

func (s *Service) GetStackStats(ctx context.Context, userID uint, serverID uint, stackname string) (*StackStats, error) {
	s.logger.Debug("getting stack statistics",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.read")
	if err != nil {
		s.logger.Error("failed to check permission for stack stats",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack statistics",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("user does not have permission to access this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for stack stats",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/stats", stackname), nil)
	if err != nil {
		s.logger.Error("failed to fetch stack stats from agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to make request to agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for stack stats",
			zap.String("status", resp.Status),
			zap.Int("status_code", resp.StatusCode),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("agent returned error: %s", resp.Status)
	}

	var stackStats StackStats
	if err := json.NewDecoder(resp.Body).Decode(&stackStats); err != nil {
		s.logger.Error("failed to decode stack stats response",
			zap.Error(err),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	s.logger.Info("stack statistics retrieved",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", stackname),
	)

	return &stackStats, nil
}

func (s *Service) fetchContainerImageDetailsFromAgent(ctx context.Context, server *models.Server, stackname string) ([]ContainerImageDetails, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/images", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var imageDetails []ContainerImageDetails
	if err := json.NewDecoder(resp.Body).Decode(&imageDetails); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return imageDetails, nil
}

func (s *Service) GetComposeConfig(ctx context.Context, userID uint, serverID uint, stackname string) (map[string]any, error) {
	s.logger.Debug("getting compose config",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "files.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to read files in this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	return s.fetchComposeConfigFromAgent(ctx, server, stackname)
}

func (s *Service) fetchComposeConfigFromAgent(ctx context.Context, server *models.Server, stackname string) (map[string]any, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/compose", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var composeConfig map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&composeConfig); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return composeConfig, nil
}

func (s *Service) UpdateCompose(ctx context.Context, userID uint, serverID uint, stackname string, changes map[string]any) (map[string]any, error) {
	s.logger.Debug("updating compose config",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "files.write")
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("user does not have permission to write files in this stack")
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	return s.updateComposeOnAgent(ctx, server, stackname, changes)
}

func (s *Service) updateComposeOnAgent(ctx context.Context, server *models.Server, stackname string, changes map[string]any) (map[string]any, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "PATCH", fmt.Sprintf("/stacks/%s/compose", stackname), changes)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if msg, ok := result["error"].(string); ok {
			return nil, fmt.Errorf("agent error: %s", msg)
		}
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return result, nil
}
