package models

import (
	"fmt"
)

type StackStatistics struct {
	TotalStacks     int `json:"total_stacks"`
	HealthyStacks   int `json:"healthy_stacks"`
	UnhealthyStacks int `json:"unhealthy_stacks"`
}

type Server struct {
	BaseModel
	Name                string `json:"name" gorm:"not null"`
	Description         string `json:"description"`
	Host                string `json:"host" gorm:"not null"`
	Port                int    `json:"port" gorm:"not null;default:8080"`
	SkipSSLVerification *bool  `json:"skip_ssl_verification" gorm:"default:true"`
	AccessToken         string `json:"-" gorm:"not null"`
	IsActive            bool   `json:"is_active" gorm:"default:true"`
}

type ServerResponse struct {
	ID                  uint   `json:"id"`
	CreatedAt           string `json:"created_at"`
	UpdatedAt           string `json:"updated_at"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	Host                string `json:"host"`
	Port                int    `json:"port"`
	SkipSSLVerification bool   `json:"skip_ssl_verification"`
	IsActive            bool   `json:"is_active"`
}

type ServerWithStatistics struct {
	ID                  uint             `json:"id"`
	CreatedAt           string           `json:"created_at"`
	UpdatedAt           string           `json:"updated_at"`
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Host                string           `json:"host"`
	Port                int              `json:"port"`
	SkipSSLVerification bool             `json:"skip_ssl_verification"`
	IsActive            bool             `json:"is_active"`
	Statistics          *StackStatistics `json:"statistics,omitempty"`
}

func (s *Server) GetBaseURL() string {
	return fmt.Sprintf("https://%s:%d", s.Host, s.Port)
}

func (s *Server) GetAPIURL() string {
	return s.GetBaseURL() + "/api"
}

func (s *Server) ToResponse() ServerResponse {
	skipSSL := true
	if s.SkipSSLVerification != nil {
		skipSSL = *s.SkipSSLVerification
	}

	return ServerResponse{
		ID:                  s.ID,
		CreatedAt:           s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:           s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:                s.Name,
		Description:         s.Description,
		Host:                s.Host,
		Port:                s.Port,
		SkipSSLVerification: skipSSL,
		IsActive:            s.IsActive,
	}
}

func (s *Server) ToResponseWithStatistics(statistics *StackStatistics) ServerWithStatistics {
	skipSSL := true
	if s.SkipSSLVerification != nil {
		skipSSL = *s.SkipSSLVerification
	}

	return ServerWithStatistics{
		ID:                  s.ID,
		CreatedAt:           s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:           s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:                s.Name,
		Description:         s.Description,
		Host:                s.Host,
		Port:                s.Port,
		SkipSSLVerification: skipSSL,
		IsActive:            s.IsActive,
		Statistics:          statistics,
	}
}
