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
