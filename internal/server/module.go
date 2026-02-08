package server

import (
	"berth/internal/agent"
	"berth/internal/crypto"
	"berth/internal/rbac"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, crypto *crypto.Crypto, rbacSvc *rbac.Service, agentSvc *agent.Service, logger *logging.Service) *Service {
		return NewService(db, crypto, rbacSvc, agentSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(NewAPIHandler),
	fx.Provide(NewUserAPIHandler),
)
