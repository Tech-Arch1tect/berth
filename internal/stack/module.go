package stack

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/security"
	"berth/internal/server"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *zap.Logger) *Service {
		return NewService(agentSvc, serverSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(func(service *Service, logger *zap.Logger, auditService *security.AuditService, db *gorm.DB) *APIHandler {
		return NewAPIHandler(service, logger, auditService, db)
	}),
)
