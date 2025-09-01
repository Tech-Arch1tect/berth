package server

import (
	"berth/internal/agent"
	"berth/internal/rbac"
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

	"gorm.io/gorm"
)

type Service struct {
	db       *gorm.DB
	crypto   *utils.Crypto
	rbacSvc  *rbac.Service
	agentSvc *agent.Service
}

func NewService(db *gorm.DB, crypto *utils.Crypto, rbacSvc *rbac.Service, agentSvc *agent.Service) *Service {
	return &Service{
		db:       db,
		crypto:   crypto,
		rbacSvc:  rbacSvc,
		agentSvc: agentSvc,
	}
}

func (s *Service) ListServers() ([]models.ServerResponse, error) {
	var servers []models.Server
	if err := s.db.Find(&servers).Error; err != nil {
		return nil, err
	}

	responses := make([]models.ServerResponse, len(servers))
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

func (s *Service) GetServerResponse(id uint) (*models.ServerResponse, error) {
	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	response := server.ToResponse()
	return &response, nil
}

func (s *Service) CreateServer(server *models.Server) error {
	if server.AccessToken != "" {
		encryptedToken, err := s.crypto.Encrypt(server.AccessToken)
		if err != nil {
			return fmt.Errorf("failed to encrypt access token: %w", err)
		}
		server.AccessToken = encryptedToken
	}

	return s.db.Create(server).Error
}

func (s *Service) UpdateServer(id uint, updates *models.Server) (*models.Server, error) {
	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	if updates.AccessToken != "" {
		encryptedToken, err := s.crypto.Encrypt(updates.AccessToken)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt access token: %w", err)
		}
		updates.AccessToken = encryptedToken
	}

	if err := s.db.Model(&server).Select("name", "description", "host", "port", "skip_ssl_verification", "access_token", "is_active").Updates(updates).Error; err != nil {
		return nil, err
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	return &server, nil
}

func (s *Service) DeleteServer(id uint) error {
	return s.db.Delete(&models.Server{}, id).Error
}

func (s *Service) TestServerConnection(server *models.Server) error {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	url := server.GetAPIURL() + "/health"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server health check failed with status: %d", resp.StatusCode)
	}

	return nil
}

func (s *Service) ListServersForUser(userID uint) ([]models.ServerResponse, error) {
	serverIDs, err := s.rbacSvc.GetUserAccessibleServerIDs(userID)
	if err != nil {
		return nil, err
	}

	if len(serverIDs) == 0 {
		return []models.ServerResponse{}, nil
	}

	var servers []models.Server
	if err := s.db.Where("id IN ?", serverIDs).Find(&servers).Error; err != nil {
		return nil, err
	}

	responses := make([]models.ServerResponse, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}

	return responses, nil
}

func (s *Service) GetServerStatistics(userID uint, serverID uint) (*models.StackStatistics, error) {

	accessibleServerIDs, err := s.rbacSvc.GetUserAccessibleServerIDs(userID)
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

	resp, err := s.agentSvc.MakeRequest(context.Background(), server, "GET", endpoint, nil)
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
