package server

import (
	"berth/internal/domain/authz"
	berthcrypto "berth/internal/pkg/crypto"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type serverAuthorizer interface {
	ReachableServerIDs(p authz.Principal) ([]uint, error)
}

type stackPatternProvider interface {
	GetUserAccessibleStackPatterns(userID, serverID uint) ([]string, error)
}

type serverAgentClient interface {
	MakeRequest(ctx context.Context, server *Server, method, endpoint string, payload any) (*http.Response, error)
	MakeReadRequest(ctx context.Context, server *Server, method, endpoint string, payload any) (*http.Response, error)
	HealthCheck(ctx context.Context, server *Server) error
}

type agentLifecycle interface {
	ConnectToAgent(server *Server) error
	DisconnectAgent(serverID uint)
}

type Service struct {
	db         *gorm.DB
	crypto     *berthcrypto.Crypto
	authzSvc   serverAuthorizer
	patternSvc stackPatternProvider
	agentSvc   serverAgentClient
	agentLife  agentLifecycle
	logger     *zap.Logger
}

func NewService(db *gorm.DB, crypto *berthcrypto.Crypto, authzSvc serverAuthorizer, patternSvc stackPatternProvider, agentSvc serverAgentClient, logger *zap.Logger) *Service {
	return &Service{
		db:         db,
		crypto:     crypto,
		authzSvc:   authzSvc,
		patternSvc: patternSvc,
		agentSvc:   agentSvc,
		logger:     logger,
	}
}

func (s *Service) SetAgentLifecycle(a agentLifecycle) {
	s.agentLife = a
}

func (s *Service) ListServers() ([]ServerInfo, error) {
	var servers []Server
	if err := s.db.Find(&servers).Error; err != nil {
		return nil, err
	}

	responses := make([]ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}

	return responses, nil
}

func (s *Service) GetServer(id uint) (*Server, error) {
	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	return &server, nil
}

func (s *Service) GetActiveServerForUser(ctx context.Context, id uint, p authz.Principal) (*Server, error) {
	s.logger.Debug("getting active server for user",
		zap.Uint("server_id", id),
		zap.Uint("user_id", p.UserID()),
	)

	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for user access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, err
	}

	if !server.IsActive {
		s.logger.Warn("user attempted to access inactive server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, fmt.Errorf("server is not active")
	}

	serverIDs, err := s.authzSvc.ReachableServerIDs(p)
	if err != nil {
		s.logger.Error("failed to check user server access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, fmt.Errorf("failed to get user accessible servers: %w", err)
	}

	hasAccess := slices.Contains(serverIDs, id)

	if !hasAccess {
		s.logger.Warn("user access denied to server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, fmt.Errorf("user does not have access to this server")
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		s.logger.Error("failed to decrypt server access token",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	s.logger.Debug("server access granted to user",
		zap.Uint("server_id", id),
		zap.String("server_name", server.Name),
		zap.Uint("user_id", p.UserID()),
	)

	return &server, nil
}

func (s *Service) GetServerResponse(id uint) (*ServerInfo, error) {
	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	response := server.ToResponse()
	return &response, nil
}

func (s *Service) CreateServer(server *Server) error {
	s.logger.Info("creating new server",
		zap.String("name", server.Name),
		zap.String("host", server.Host),
		zap.Int("port", server.Port),
	)

	if server.AccessToken == "" {
		s.logger.Error("access token is required when creating a server",
			zap.String("server_name", server.Name),
		)
		return ErrServerAccessTokenRequired
	}

	encryptedToken, err := s.crypto.Encrypt(server.AccessToken)
	if err != nil {
		s.logger.Error("failed to encrypt server access token",
			zap.Error(err),
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}
	server.AccessToken = encryptedToken

	if err := s.db.Create(server).Error; err != nil {
		s.logger.Error("failed to create server in database",
			zap.Error(err),
			zap.String("name", server.Name),
			zap.String("host", server.Host),
		)
		return err
	}

	s.logger.Info("server created successfully",
		zap.Uint("server_id", server.ID),
		zap.String("name", server.Name),
		zap.String("host", server.Host),
		zap.Int("port", server.Port),
	)

	if s.agentLife != nil {
		if connectServer, err := s.GetServer(server.ID); err != nil {
			s.logger.Warn("failed to load server for agent connection after create",
				zap.Error(err), zap.Uint("server_id", server.ID))
		} else if err := s.agentLife.ConnectToAgent(connectServer); err != nil {
			s.logger.Warn("failed to open agent connection for new server",
				zap.Error(err), zap.Uint("server_id", server.ID))
		}
	}

	return nil
}

func (s *Service) UpdateServer(id uint, updates *Server) (*Server, error) {
	s.logger.Info("updating server",
		zap.Uint("server_id", id),
		zap.String("name", updates.Name),
		zap.String("host", updates.Host),
	)

	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for update",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return nil, err
	}

	if updates.AccessToken != "" {
		encryptedToken, err := s.crypto.Encrypt(updates.AccessToken)
		if err != nil {
			s.logger.Error("failed to encrypt updated access token",
				zap.Error(err),
				zap.Uint("server_id", id),
			)
			return nil, fmt.Errorf("failed to encrypt access token: %w", err)
		}
		updates.AccessToken = encryptedToken
	}

	if err := s.db.Model(&server).Select("name", "description", "host", "port", "skip_ssl_verification", "access_token", "is_active").Updates(updates).Error; err != nil {
		s.logger.Error("failed to update server in database",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.String("name", updates.Name),
		)
		return nil, err
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		s.logger.Error("failed to decrypt access token after update",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	s.logger.Info("server updated successfully",
		zap.Uint("server_id", id),
		zap.String("name", server.Name),
		zap.String("host", server.Host),
	)

	return &server, nil
}

func (s *Service) DeleteServer(id uint) error {
	s.logger.Info("deleting server",
		zap.Uint("server_id", id),
	)

	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for deletion",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return err
	}

	if err := s.db.Delete(&server).Error; err != nil {
		s.logger.Error("failed to delete server from database",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
		)
		return err
	}

	s.logger.Info("server deleted successfully",
		zap.Uint("server_id", id),
		zap.String("server_name", server.Name),
	)

	if s.agentLife != nil {
		s.agentLife.DisconnectAgent(id)
	}

	return nil
}

func (s *Service) TestServerConnection(ctx context.Context, server *Server) error {
	s.logger.Info("testing server connection",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.String("host", server.Host),
	)

	if err := s.agentSvc.HealthCheck(ctx, server); err != nil {
		s.logger.Error("server connection test failed",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return err
	}

	s.logger.Info("server connection test successful",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return nil
}

func (s *Service) ListServersByIDs(serverIDs []uint) ([]ServerInfo, error) {
	if len(serverIDs) == 0 {
		return []ServerInfo{}, nil
	}

	var servers []Server
	if err := s.db.Where("id IN ? AND is_active = ?", serverIDs, true).Find(&servers).Error; err != nil {
		s.logger.Error("failed to query servers by ID",
			zap.Error(err),
			zap.Int("server_id_count", len(serverIDs)),
		)
		return nil, err
	}

	responses := make([]ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}
	return responses, nil
}

func (s *Service) GetServerStatistics(ctx context.Context, p authz.Principal, serverID uint) (*StackStatistics, error) {

	accessibleServerIDs, err := s.authzSvc.ReachableServerIDs(p)
	if err != nil {
		return nil, err
	}

	hasAccess := slices.Contains(accessibleServerIDs, serverID)

	if !hasAccess {
		return nil, fmt.Errorf("user does not have access to server")
	}

	patterns, err := s.patternSvc.GetUserAccessibleStackPatterns(p.UserID(), serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user accessible patterns: %w", err)
	}

	if len(patterns) == 0 {
		return &StackStatistics{
			TotalStacks:     0,
			HealthyStacks:   0,
			UnhealthyStacks: 0,
		}, nil
	}

	server, err := s.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	patternsParam := strings.Join(patterns, ",")
	endpoint := fmt.Sprintf("/stacks/summary?patterns=%s", url.QueryEscape(patternsParam))

	resp, err := s.agentSvc.MakeReadRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned error: %s", resp.Status)
	}

	var stackSummary StackStatistics
	if err := json.NewDecoder(resp.Body).Decode(&stackSummary); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &stackSummary, nil
}
