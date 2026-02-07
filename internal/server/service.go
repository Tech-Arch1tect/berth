package server

import (
	"berth/models"
	"berth/utils"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type accessChecker interface {
	GetUserAccessibleServerIDs(ctx context.Context, userID uint) ([]uint, error)
	GetUserAccessibleStackPatterns(userID, serverID uint) ([]string, error)
}

type serverAgentClient interface {
	MakeRequest(ctx context.Context, server *models.Server, method, endpoint string, payload any) (*http.Response, error)
}

type Service struct {
	db       *gorm.DB
	crypto   *utils.Crypto
	rbacSvc  accessChecker
	agentSvc serverAgentClient
	logger   *logging.Service
}

func NewService(db *gorm.DB, crypto *utils.Crypto, rbacSvc accessChecker, agentSvc serverAgentClient, logger *logging.Service) *Service {
	return &Service{
		db:       db,
		crypto:   crypto,
		rbacSvc:  rbacSvc,
		agentSvc: agentSvc,
		logger:   logger,
	}
}

func (s *Service) ListServers() ([]models.ServerInfo, error) {
	var servers []models.Server
	if err := s.db.Find(&servers).Error; err != nil {
		return nil, err
	}

	responses := make([]models.ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}

	return responses, nil
}

func (s *Service) GetServer(id uint) (*models.Server, error) {
	var server models.Server
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

func (s *Service) GetActiveServerForUser(ctx context.Context, id uint, userID uint) (*models.Server, error) {
	s.logger.Debug("getting active server for user",
		zap.Uint("server_id", id),
		zap.Uint("user_id", userID),
	)

	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for user access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", userID),
		)
		return nil, err
	}

	if !server.IsActive {
		s.logger.Warn("user attempted to access inactive server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("server is not active")
	}

	serverIDs, err := s.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
	if err != nil {
		s.logger.Error("failed to check user server access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get user accessible servers: %w", err)
	}

	hasAccess := slices.Contains(serverIDs, id)

	if !hasAccess {
		s.logger.Warn("user access denied to server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", userID),
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
		zap.Uint("user_id", userID),
	)

	return &server, nil
}

func (s *Service) GetServerResponse(id uint) (*models.ServerInfo, error) {
	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	response := server.ToResponse()
	return &response, nil
}

func (s *Service) CreateServer(server *models.Server) error {
	s.logger.Info("creating new server",
		zap.String("name", server.Name),
		zap.String("host", server.Host),
		zap.Int("port", server.Port),
	)

	if server.AccessToken == "" {
		s.logger.Error("access token is required when creating a server",
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("access token is required")
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

	return nil
}

func (s *Service) UpdateServer(id uint, updates *models.Server) (*models.Server, error) {
	s.logger.Info("updating server",
		zap.Uint("server_id", id),
		zap.String("name", updates.Name),
		zap.String("host", updates.Host),
	)

	var server models.Server
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

	var server models.Server
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

	return nil
}

func (s *Service) TestServerConnection(server *models.Server) error {
	s.logger.Info("testing server connection",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.String("host", server.Host),
	)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		s.logger.Warn("SSL verification disabled for connection test",
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	url := server.GetAPIURL() + "/health"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		s.logger.Error("failed to create test request",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("url", url),
		)
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)

	resp, err := client.Do(req)
	if err != nil {
		s.logger.Error("server connection test failed",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
			zap.String("url", url),
		)
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("server health check failed",
			zap.Int("status_code", resp.StatusCode),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("server health check failed with status: %d", resp.StatusCode)
	}

	s.logger.Info("server connection test successful",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return nil
}

func (s *Service) ListServersForUser(ctx context.Context, userID uint) ([]models.ServerInfo, error) {
	s.logger.Debug("listing servers for user",
		zap.Uint("user_id", userID),
	)

	serverIDs, err := s.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
	if err != nil {
		s.logger.Error("failed to get user accessible servers",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, err
	}

	if len(serverIDs) == 0 {
		s.logger.Debug("user has no accessible servers",
			zap.Uint("user_id", userID),
		)
		return []models.ServerInfo{}, nil
	}

	var servers []models.Server
	if err := s.db.Where("id IN ? AND is_active = ?", serverIDs, true).Find(&servers).Error; err != nil {
		s.logger.Error("failed to query servers for user",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Int("server_id_count", len(serverIDs)),
		)
		return nil, err
	}

	responses := make([]models.ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}

	s.logger.Debug("servers listed for user",
		zap.Uint("user_id", userID),
		zap.Int("accessible_count", len(serverIDs)),
		zap.Int("active_count", len(servers)),
	)

	return responses, nil
}

func (s *Service) GetServerStatistics(ctx context.Context, userID uint, serverID uint) (*models.StackStatistics, error) {

	accessibleServerIDs, err := s.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
	if err != nil {
		return nil, err
	}

	hasAccess := slices.Contains(accessibleServerIDs, serverID)

	if !hasAccess {
		return nil, fmt.Errorf("user does not have access to server")
	}

	patterns, err := s.rbacSvc.GetUserAccessibleStackPatterns(userID, serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user accessible patterns: %w", err)
	}

	if len(patterns) == 0 {
		return &models.StackStatistics{
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

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned error: %s", resp.Status)
	}

	var stackSummary models.StackStatistics
	if err := json.NewDecoder(resp.Body).Decode(&stackSummary); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &stackSummary, nil
}
