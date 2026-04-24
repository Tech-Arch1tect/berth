package maintenance

import (
	"berth/internal/domain/agent"
	"berth/internal/domain/rbac"
	"berth/internal/domain/security"
	"berth/internal/domain/server"

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
