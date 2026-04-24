package imageupdates

import (
	"berth/internal/domain/agent"
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	"berth/internal/pkg/config"
	"berth/internal/pkg/crypto"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, agentSvc *agent.Service, serverSvc *server.Service, crypto *crypto.Crypto, logger *zap.Logger, cfg *config.Config) *Service {
		return NewService(db, agentSvc, serverSvc, crypto, logger, cfg)
	}),
	fx.Provide(func(svc *Service, rbacSvc *rbac.Service, logger *zap.Logger) *APIHandler {
		return NewAPIHandler(svc, rbacSvc, logger)
	}),
)
