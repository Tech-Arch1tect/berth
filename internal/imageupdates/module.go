package imageupdates

import (
	"berth/internal/agent"
	"berth/internal/config"
	"berth/internal/crypto"
	"berth/internal/rbac"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, agentSvc *agent.Service, serverSvc *server.Service, crypto *crypto.Crypto, logger *logging.Service, cfg *config.BerthConfig) *Service {
		return NewService(db, agentSvc, serverSvc, crypto, logger, cfg)
	}),
	fx.Provide(func(svc *Service, rbacSvc *rbac.Service, logger *logging.Service) *APIHandler {
		return NewAPIHandler(svc, rbacSvc, logger)
	}),
)
