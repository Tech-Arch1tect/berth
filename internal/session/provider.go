package session

import (
	"fmt"
	"net/http"

	"berth/internal/auth/tokens"
	"berth/internal/config"

	"github.com/alexedwards/scs/v2"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Manager struct {
	*scs.SessionManager
	config config.SessionConfig
}

func ProvideSessionManager(cfg *config.Config, db *gorm.DB, logger *zap.Logger) (*Manager, error) {
	if !cfg.Session.Enabled {
		return nil, nil
	}

	sm := scs.New()

	var store scs.Store
	switch cfg.Session.Store {
	case "memory":
		store = NewMemoryStore()
	case "database":
		if db == nil {
			return nil, fmt.Errorf("database session store requires database to be enabled")
		}
		s, err := NewDatabaseStore(db)
		if err != nil {
			return nil, fmt.Errorf("create database session store: %w", err)
		}
		store = s
	default:
		return nil, fmt.Errorf("unsupported session store: %s", cfg.Session.Store)
	}

	sm.Store = store
	sm.Lifetime = cfg.Session.MaxAge
	sm.IdleTimeout = cfg.Session.MaxAge
	sm.Cookie.Name = cfg.Session.Name
	sm.Cookie.Path = cfg.Session.Path
	sm.Cookie.Domain = cfg.Session.Domain
	sm.Cookie.Secure = cfg.Session.Secure
	sm.Cookie.HttpOnly = cfg.Session.HttpOnly

	switch cfg.Session.SameSite {
	case "strict":
		sm.Cookie.SameSite = http.SameSiteStrictMode
	case "none":
		sm.Cookie.SameSite = http.SameSiteNoneMode
	default:
		sm.Cookie.SameSite = http.SameSiteLaxMode
	}

	return &Manager{SessionManager: sm, config: cfg.Session}, nil
}

func ProvideSessionService(db *gorm.DB, manager *Manager, t *tokens.Service, logger *zap.Logger) *Service {
	if db == nil || manager == nil {
		return nil
	}
	return &Service{db: db, sessionManager: manager, tokens: t, logger: logger}
}

var Module = fx.Module("session",
	fx.Provide(ProvideSessionManager),
	fx.Provide(ProvideSessionService),
	fx.Provide(NewHandler),
)
