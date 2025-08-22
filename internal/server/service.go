package server

import (
	"brx-starter-kit/models"
	"fmt"
	"net/http"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListServers() ([]models.Server, error) {
	var servers []models.Server
	if err := s.db.Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (s *Service) GetServer(id uint) (*models.Server, error) {
	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

func (s *Service) CreateServer(server *models.Server) error {
	return s.db.Create(server).Error
}

func (s *Service) UpdateServer(id uint, updates *models.Server) (*models.Server, error) {
	var server models.Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&server).Updates(updates).Error; err != nil {
		return nil, err
	}

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
