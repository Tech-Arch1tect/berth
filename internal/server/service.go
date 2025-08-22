package server

import (
	"brx-starter-kit/models"
	"brx-starter-kit/utils"
	"fmt"
	"net/http"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	crypto *utils.Crypto
}

func NewService(db *gorm.DB, crypto *utils.Crypto) *Service {
	return &Service{
		db:     db,
		crypto: crypto,
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

	if err := s.db.Model(&server).Updates(updates).Error; err != nil {
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
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server health check failed with status: %d", resp.StatusCode)
	}

	return nil
}
