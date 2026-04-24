package server

import (
	"berth/internal/pkg/crypto"
	"berth/internal/platform/agent"
	"berth/internal/rbac"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, crypto *crypto.Crypto, rbacSvc *rbac.Service, agentSvc *agent.Service, logger *zap.Logger) *Service {
		return NewService(db, crypto, rbacSvc, agentSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(NewAPIHandler),
	fx.Provide(NewUserAPIHandler),
)
