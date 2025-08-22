package models

import (
	"fmt"

	"gorm.io/gorm"
)

type Server struct {
	gorm.Model
	Name        string `json:"name" gorm:"not null"`
	Description string `json:"description"`
	Host        string `json:"host" gorm:"not null"`
	Port        int    `json:"port" gorm:"not null;default:8080"`
	UseHTTPS    bool   `json:"use_https" gorm:"default:false"`
	AccessToken string `json:"access_token" gorm:"not null"`
	IsActive    bool   `json:"is_active" gorm:"default:true"`
}

type ServerResponse struct {
	ID          uint   `json:"ID"`
	CreatedAt   string `json:"CreatedAt"`
	UpdatedAt   string `json:"UpdatedAt"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	UseHTTPS    bool   `json:"use_https"`
	IsActive    bool   `json:"is_active"`
}

func (s *Server) GetBaseURL() string {
	protocol := "http"
	if s.UseHTTPS {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s:%d", protocol, s.Host, s.Port)
}

func (s *Server) GetAPIURL() string {
	return s.GetBaseURL() + "/api"
}

func (s *Server) ToResponse() ServerResponse {
	return ServerResponse{
		ID:          s.ID,
		CreatedAt:   s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:        s.Name,
		Description: s.Description,
		Host:        s.Host,
		Port:        s.Port,
		UseHTTPS:    s.UseHTTPS,
		IsActive:    s.IsActive,
	}
}
