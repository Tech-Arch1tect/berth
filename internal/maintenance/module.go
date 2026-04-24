package maintenance

import (
	"berth/internal/platform/agent"
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
	fx.Provide(func(service *Service, auditService *security.AuditService, db *gorm.DB) *APIHandler {
		return NewAPIHandler(service, auditService, db)
	}),
)
