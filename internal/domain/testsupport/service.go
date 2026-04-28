//go:build e2e

package testsupport

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"berth/internal/domain/auth"
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/crypto"
	"berth/seeds"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DatabaseModels []any

type Service struct {
	db      *gorm.DB
	authSvc *auth.Service
	rbacSvc *rbac.Service
	crypto  *crypto.Crypto
	models  DatabaseModels
	logger  *zap.Logger

	mu      sync.Mutex
	agents  map[uint64]*MockAgent
	agentID uint64
}

func NewService(db *gorm.DB, authSvc *auth.Service, rbacSvc *rbac.Service, crypto *crypto.Crypto, models DatabaseModels, logger *zap.Logger) *Service {
	return &Service{
		db:      db,
		authSvc: authSvc,
		rbacSvc: rbacSvc,
		crypto:  crypto,
		models:  models,
		logger:  logger,
		agents:  make(map[uint64]*MockAgent),
	}
}

func (s *Service) Reset() error {
	s.closeAllAgents()

	tables, err := s.db.Migrator().GetTables()
	if err != nil {
		return fmt.Errorf("list tables: %w", err)
	}
	for _, t := range tables {
		if strings.HasPrefix(t, "sqlite_") {
			continue
		}
		if err := s.db.Migrator().DropTable(t); err != nil {
			return fmt.Errorf("drop table %s: %w", t, err)
		}
	}

	if err := s.db.AutoMigrate(s.models...); err != nil {
		return fmt.Errorf("re-migrate: %w", err)
	}
	if err := seeds.SeedRBACData(s.db); err != nil {
		return fmt.Errorf("reseed rbac: %w", err)
	}
	return nil
}

type SeedUserInput struct {
	Username      string `json:"username"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	Admin         bool   `json:"admin"`
	EmailVerified bool   `json:"email_verified"`
}

type SeedUserResult struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

func (s *Service) SeedUser(in SeedUserInput) (*SeedUserResult, error) {
	if in.Username == "" || in.Email == "" || in.Password == "" {
		return nil, errors.New("username, email, password required")
	}

	hashed, err := s.authSvc.HashPassword(in.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &usermodel.User{
		Username: in.Username,
		Email:    in.Email,
		Password: hashed,
	}
	if in.EmailVerified {
		now := time.Now()
		u.EmailVerifiedAt = &now
	}

	if err := s.db.Create(u).Error; err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	roleName := rbac.RoleUser
	if in.Admin {
		roleName = rbac.RoleAdmin
	}
	if err := s.rbacSvc.AssignUserRole(u.ID, roleName); err != nil {
		return nil, fmt.Errorf("assign role: %w", err)
	}

	return &SeedUserResult{ID: u.ID, Username: u.Username, Email: u.Email}, nil
}

type SeedServerInput struct {
	Name string `json:"name"`
}

type SeedServerResult struct {
	ServerID uint   `json:"server_id"`
	AgentID  uint64 `json:"agent_id"`
	AgentURL string `json:"agent_url"`
}

func (s *Service) SeedServerWithAgent(in SeedServerInput) (*SeedServerResult, error) {
	if in.Name == "" {
		return nil, errors.New("name required")
	}

	agent := NewMockAgent()
	id := atomic.AddUint64(&s.agentID, 1)
	s.mu.Lock()
	s.agents[id] = agent
	s.mu.Unlock()

	host, port, err := splitAgentURL(agent.URL)
	if err != nil {
		agent.Close()
		return nil, err
	}

	encrypted, err := s.crypto.Encrypt("test-access-token")
	if err != nil {
		agent.Close()
		return nil, fmt.Errorf("encrypt token: %w", err)
	}

	skipSSL := true
	srv := &server.Server{
		Name:                in.Name,
		Host:                host,
		Port:                port,
		AccessToken:         encrypted,
		SkipSSLVerification: &skipSSL,
		IsActive:            true,
	}
	if err := s.db.Create(srv).Error; err != nil {
		agent.Close()
		return nil, fmt.Errorf("create server: %w", err)
	}

	return &SeedServerResult{ServerID: srv.ID, AgentID: id, AgentURL: agent.URL}, nil
}

func (s *Service) GetAgent(id uint64) (*MockAgent, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.agents[id]
	return a, ok
}

func (s *Service) closeAllAgents() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, a := range s.agents {
		a.Close()
		delete(s.agents, id)
	}
}

func splitAgentURL(rawURL string) (string, int, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", 0, fmt.Errorf("parse agent url: %w", err)
	}
	host := u.Hostname()
	portStr := u.Port()
	if portStr == "" {
		return "", 0, errors.New("agent url missing port")
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return "", 0, fmt.Errorf("parse port: %w", err)
	}
	if strings.HasPrefix(host, "[") {
		host = strings.Trim(host, "[]")
	}
	return host, port, nil
}
