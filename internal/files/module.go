package files

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
	fx.Provide(func(db *gorm.DB, service *Service, auditSvc *security.AuditService) *APIHandler {
		return NewAPIHandler(db, service, auditSvc)
	}),
)
