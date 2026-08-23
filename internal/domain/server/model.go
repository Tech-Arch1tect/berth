package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"berth/internal/platform/db"
)

var (
	ErrServerNameRequired           = errors.New("name is required")
	ErrServerHostRequired           = errors.New("host is required")
	ErrServerPortRequired           = errors.New("port must be greater than 0")
	ErrServerAccessTokenRequired    = errors.New("access token is required")
	ErrServerBackupPasswordRequired = errors.New("a backup encryption password is required when backups are enabled")
	ErrServerS3BucketIDInvalid      = errors.New("s3 bucket id must be greater than 0")
	ErrServerS3BucketNotFound       = errors.New("s3 bucket configuration not found")
	ErrBackupStorageBusy            = errors.New("backup storage is in use by another operation; try again once it finishes")
	ErrBackupStorageHasHistory      = errors.New("backup storage cannot change while backup history remains")
	ErrBackupStorageUnavailable     = errors.New("backup storage status is unavailable")
	ErrServerNotFound               = errors.New("server not found")
)

type StackStatistics struct {
	TotalStacks     int `json:"total_stacks"`
	HealthyStacks   int `json:"healthy_stacks"`
	UnhealthyStacks int `json:"unhealthy_stacks"`
}

type Server struct {
	db.BaseModel
	Name                string `json:"name" gorm:"not null"`
	Description         string `json:"description"`
	Host                string `json:"host" gorm:"not null"`
	Port                int    `json:"port" gorm:"not null;default:8080"`
	SkipSSLVerification *bool  `json:"skip_ssl_verification,omitempty" gorm:"default:true"`
	AccessToken         string `json:"-" gorm:"not null"`
	IsActive            bool   `json:"is_active" gorm:"default:true"`
	BackupsEnabled      bool   `json:"backups_enabled" gorm:"not null;default:false"`
	BackupPassword      string `json:"-"`
	S3BucketID          *uint  `json:"s3_bucket_id,omitempty" gorm:"index"`

	AgentCertFingerprint          string     `json:"-"`
	AgentCertAuthorityFingerprint string     `json:"-"`
	AgentCertIssuedAt             *time.Time `json:"-"`
	AgentCertExpiresAt            *time.Time `json:"-"`
}

type ServerInfo struct {
	ID                            uint   `json:"id"`
	CreatedAt                     string `json:"created_at"`
	UpdatedAt                     string `json:"updated_at"`
	Name                          string `json:"name"`
	Description                   string `json:"description"`
	Host                          string `json:"host"`
	Port                          int    `json:"port"`
	SkipSSLVerification           bool   `json:"skip_ssl_verification"`
	IsActive                      bool   `json:"is_active"`
	BackupsEnabled                bool   `json:"backups_enabled"`
	S3BucketID                    *uint  `json:"s3_bucket_id,omitempty"`
	AgentCertFingerprint          string `json:"agent_cert_fingerprint,omitempty"`
	AgentCertAuthorityFingerprint string `json:"agent_cert_authority_fingerprint,omitempty"`
	AgentCertIssuedAt             string `json:"agent_cert_issued_at,omitempty"`
	AgentCertExpiresAt            string `json:"agent_cert_expires_at,omitempty"`
}

type ServerCreateRequest struct {
	Name                string `json:"name"`
	Description         string `json:"description,omitempty"`
	Host                string `json:"host"`
	Port                int    `json:"port"`
	SkipSSLVerification *bool  `json:"skip_ssl_verification,omitempty"`
	AccessToken         string `json:"access_token"`
	IsActive            bool   `json:"is_active,omitempty"`
	BackupsEnabled      bool   `json:"backups_enabled,omitempty"`
	BackupPassword      string `json:"backup_password,omitempty"`
}

func (r *ServerCreateRequest) Validate() error {
	if r.Name == "" {
		return ErrServerNameRequired
	}
	if r.Host == "" {
		return ErrServerHostRequired
	}
	if r.Port <= 0 {
		return ErrServerPortRequired
	}
	if r.AccessToken == "" {
		return ErrServerAccessTokenRequired
	}
	if r.BackupsEnabled && r.BackupPassword == "" {
		return ErrServerBackupPasswordRequired
	}
	return nil
}

type ServerUpdateRequest struct {
	Name                string `json:"name"`
	Description         string `json:"description,omitempty"`
	Host                string `json:"host"`
	Port                int    `json:"port"`
	SkipSSLVerification *bool  `json:"skip_ssl_verification,omitempty"`
	AccessToken         string `json:"access_token,omitempty"`
	IsActive            bool   `json:"is_active,omitempty"`
	BackupsEnabled      bool   `json:"backups_enabled,omitempty"`
	BackupPassword      string `json:"backup_password,omitempty"`
	S3BucketID          *uint  `json:"s3_bucket_id,omitempty"`
	s3BucketIDSet       bool
}

func (r *ServerUpdateRequest) UnmarshalJSON(data []byte) error {
	type requestAlias ServerUpdateRequest
	var decoded requestAlias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	*r = ServerUpdateRequest(decoded)
	_, r.s3BucketIDSet = fields["s3_bucket_id"]
	return nil
}

func (r *ServerUpdateRequest) Validate() error {
	if r.Name == "" {
		return ErrServerNameRequired
	}
	if r.Host == "" {
		return ErrServerHostRequired
	}
	if r.Port <= 0 {
		return ErrServerPortRequired
	}
	if r.s3BucketIDSet && r.S3BucketID != nil && *r.S3BucketID == 0 {
		return ErrServerS3BucketIDInvalid
	}
	return nil
}

func (r *ServerCreateRequest) ToServer() *Server {
	return &Server{
		Name:                r.Name,
		Description:         r.Description,
		Host:                r.Host,
		Port:                r.Port,
		SkipSSLVerification: r.SkipSSLVerification,
		AccessToken:         r.AccessToken,
		IsActive:            r.IsActive,
		BackupsEnabled:      r.BackupsEnabled,
		BackupPassword:      r.BackupPassword,
	}
}

type ServerWithStatistics struct {
	ID                  uint             `json:"id"`
	CreatedAt           string           `json:"created_at"`
	UpdatedAt           string           `json:"updated_at"`
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Host                string           `json:"host"`
	Port                int              `json:"port"`
	SkipSSLVerification bool             `json:"skip_ssl_verification,omitempty"`
	IsActive            bool             `json:"is_active"`
	Statistics          *StackStatistics `json:"statistics,omitempty"`
}

func (s *Server) GetBaseURL() string {
	return fmt.Sprintf("https://%s:%d", s.Host, s.Port)
}

func (s *Server) GetAPIURL() string {
	return s.GetBaseURL() + "/api"
}

func (s *Server) ToResponse() ServerInfo {
	skipSSL := true
	if s.SkipSSLVerification != nil {
		skipSSL = *s.SkipSSLVerification
	}

	return ServerInfo{
		ID:                            s.ID,
		CreatedAt:                     s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:                     s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Name:                          s.Name,
		Description:                   s.Description,
		Host:                          s.Host,
		Port:                          s.Port,
		SkipSSLVerification:           skipSSL,
		IsActive:                      s.IsActive,
		BackupsEnabled:                s.BackupsEnabled,
		S3BucketID:                    s.S3BucketID,
		AgentCertFingerprint:          s.AgentCertFingerprint,
		AgentCertAuthorityFingerprint: s.AgentCertAuthorityFingerprint,
		AgentCertIssuedAt:             formatTimestamp(s.AgentCertIssuedAt),
		AgentCertExpiresAt:            formatTimestamp(s.AgentCertExpiresAt),
	}
}

func formatTimestamp(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02T15:04:05Z07:00")
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
