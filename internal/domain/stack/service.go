package stack

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"
	"berth/internal/pkg/validation"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"go.uber.org/zap"
)

var (
	ErrPermissionDenied   = errors.New("permission denied")
	ErrStackAlreadyExists = errors.New("stack already exists")
	ErrInvalidStackName   = errors.New("invalid stack name")
)

type stackAgentClient interface {
	MakeRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error)
}

type stackServerProvider interface {
	GetServer(id uint) (*server.Server, error)
	GetServerResponse(id uint) (*server.ServerInfo, error)
	GetActiveServerForUser(ctx context.Context, id uint, p authz.Principal) (*server.Server, error)
}

type stackAuthorizer interface {
	HasStackPermission(p authz.Principal, serverID uint, stackname, permission string) (bool, error)
	HasServerPermission(p authz.Principal, serverID uint, permission string) (bool, error)
	StackPermissions(p authz.Principal, serverID uint, stackname string) ([]string, error)
}

type Service struct {
	agentSvc  stackAgentClient
	serverSvc stackServerProvider
	authzSvc  stackAuthorizer
	logger    *zap.Logger
}

func NewService(agentSvc stackAgentClient, serverSvc stackServerProvider, authzSvc stackAuthorizer, logger *zap.Logger) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		authzSvc:  authzSvc,
		logger:    logger,
	}
}

func (s *Service) GetServerInfo(serverID uint) (*server.ServerInfo, error) {
	return s.serverSvc.GetServerResponse(serverID)
}

func (s *Service) ListStacksForServer(ctx context.Context, serverID uint, scope authz.ScopeSet) ([]Stack, error) {
	s.logger.Debug("listing stacks for server", zap.Uint("server_id", serverID))

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for stack listing",
			zap.Error(err),
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

	accessibleStacks := make([]Stack, 0, len(allStacks))
	for _, stack := range allStacks {
		if !scope.AllowsStack(serverID, stack.Name) {
			continue
		}
		stack.ServerID = server.ID
		stack.ServerName = server.Name
		accessibleStacks = append(accessibleStacks, stack)
	}

	s.logger.Info("stacks listed for server",
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.Int("total_stacks", len(allStacks)),
		zap.Int("accessible_stacks", len(accessibleStacks)),
	)

	return accessibleStacks, nil
}

func (s *Service) CreateStack(ctx context.Context, p authz.Principal, serverID uint, name string) (*Stack, error) {
	s.logger.Debug("creating new stack",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", name),
	)

	if err := validation.ValidateStackName(name); err != nil {
		s.logger.Warn("invalid stack name rejected",
			zap.Uint("user_id", p.UserID()),
			zap.String("stack_name", name),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: %v", ErrInvalidStackName, err)
	}

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, name, permnames.StacksCreate)
	if err != nil {
		s.logger.Error("failed to check create permission",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", name),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied create stack permission",
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", name),
		)
		return nil, fmt.Errorf("%w: stacks.create required for pattern matching '%s'", ErrPermissionDenied, name)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		s.logger.Error("failed to get server for stack creation",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
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
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", name),
	)

	return stack, nil
}

func (s *Service) createStackOnAgent(ctx context.Context, server *server.Server, name string) (*Stack, error) {
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
			if strings.Contains(strings.ToLower(result.Error), "already exists") {
				return nil, fmt.Errorf("%w: %s", ErrStackAlreadyExists, result.Error)
			}
			return nil, fmt.Errorf("agent error: %s", result.Error)
		}
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return result.Stack, nil
}

func (s *Service) GetStackDetails(ctx context.Context, p authz.Principal, serverID uint, stackname string) (*StackDetails, error) {
	s.logger.Debug("getting stack details",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.StacksRead)
	if err != nil {
		s.logger.Error("failed to check stack permission",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack details",
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		s.logger.Error("failed to get server for stack details",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
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
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", stackname),
	)

	return stackDetails, nil
}

func (s *Service) fetchStacksFromAgent(ctx context.Context, server *server.Server) ([]Stack, error) {
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

func (s *Service) fetchStackDetailsFromAgent(ctx context.Context, server *server.Server, stackname string) (*StackDetails, error) {
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

func (s *Service) GetStackNetworks(ctx context.Context, p authz.Principal, serverID uint, stackname string) ([]Network, error) {
	s.logger.Debug("getting stack networks",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.StacksRead)
	if err != nil {
		s.logger.Error("failed to check permission for stack networks",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack networks",
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		s.logger.Error("failed to get server for stack networks",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
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
		zap.Uint("user_id", p.UserID()),
		zap.String("stack_name", stackname),
		zap.Int("network_count", len(networks)),
	)

	return networks, nil
}

func (s *Service) fetchStackNetworksFromAgent(ctx context.Context, server *server.Server, stackname string) ([]Network, error) {
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

func (s *Service) GetStackVolumes(ctx context.Context, p authz.Principal, serverID uint, stackname string) ([]Volume, error) {
	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.StacksRead)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	volumes, err := s.fetchStackVolumesFromAgent(ctx, server, stackname)
	if err != nil {
		return nil, err
	}

	return volumes, nil
}

func (s *Service) GetContainerImageDetails(ctx context.Context, p authz.Principal, serverID uint, stackname string) ([]ContainerImageDetails, error) {
	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.StacksRead)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	imageDetails, err := s.fetchContainerImageDetailsFromAgent(ctx, server, stackname)
	if err != nil {
		return nil, err
	}

	return imageDetails, nil
}

func (s *Service) fetchStackVolumesFromAgent(ctx context.Context, server *server.Server, stackname string) ([]Volume, error) {
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

func (s *Service) GetStackEnvironmentVariables(ctx context.Context, p authz.Principal, serverID uint, stackname string, unmask bool) (map[string][]ServiceEnvironment, error) {
	requiredPermission := permnames.StacksRead
	if unmask {
		requiredPermission = permnames.StacksManage
	}

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, requiredPermission)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	environmentVariables, err := s.fetchStackEnvironmentVariablesFromAgent(ctx, server, stackname, unmask)
	if err != nil {
		return nil, err
	}

	return environmentVariables, nil
}

func (s *Service) fetchStackEnvironmentVariablesFromAgent(ctx context.Context, server *server.Server, stackname string, unmask bool) (map[string][]ServiceEnvironment, error) {
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

func (s *Service) GetStackStats(ctx context.Context, p authz.Principal, serverID uint, stackname string) (*StackStats, error) {
	s.logger.Debug("getting stack statistics",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.StacksRead)
	if err != nil {
		s.logger.Error("failed to check permission for stack stats",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user denied access to stack statistics",
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("%w: cannot access this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		s.logger.Error("failed to get server for stack stats",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
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
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("server_name", server.Name),
		zap.String("stack_name", stackname),
	)

	return &stackStats, nil
}

func (s *Service) fetchContainerImageDetailsFromAgent(ctx context.Context, server *server.Server, stackname string) ([]ContainerImageDetails, error) {
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

func (s *Service) GetComposeConfig(ctx context.Context, p authz.Principal, serverID uint, stackname string) (*RawComposeConfig, error) {
	s.logger.Debug("getting compose config",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.FilesRead)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("%w: cannot read files in this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	return s.fetchComposeConfigFromAgent(ctx, server, stackname)
}

func (s *Service) fetchComposeConfigFromAgent(ctx context.Context, server *server.Server, stackname string) (*RawComposeConfig, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", fmt.Sprintf("/stacks/%s/compose", stackname), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	var composeConfig RawComposeConfig
	if err := json.NewDecoder(resp.Body).Decode(&composeConfig); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &composeConfig, nil
}

func (s *Service) UpdateCompose(ctx context.Context, p authz.Principal, serverID uint, stackname string, req *UpdateComposeRequest) (*UpdateComposeResponse, error) {
	s.logger.Debug("updating compose config",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.FilesWrite)
	if err != nil {
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("%w: cannot write files in this stack", ErrPermissionDenied)
	}

	server, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	return s.updateComposeOnAgent(ctx, server, stackname, req)
}

func (s *Service) updateComposeOnAgent(ctx context.Context, server *server.Server, stackname string, req *UpdateComposeRequest) (*UpdateComposeResponse, error) {
	resp, err := s.agentSvc.MakeRequest(ctx, server, "PATCH", fmt.Sprintf("/stacks/%s/compose", stackname), req)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result UpdateComposeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if result.Message != "" {
			return nil, fmt.Errorf("agent error: %s", result.Message)
		}
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return &result, nil
}
