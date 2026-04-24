package stack

import (
	"berth/internal/domain/agent"
	"berth/internal/domain/rbac"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/platform/inertia"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *zap.Logger) *Service {
		return NewService(agentSvc, serverSvc, rbacSvc, logger)
	}),
	fx.Provide(func(inertiaSvc *inertia.Service, service *Service, rbacSvc *rbac.Service, serverSvc *server.Service) *Handler {
		return NewHandler(inertiaSvc, service, rbacSvc, serverSvc)
	}),
	fx.Provide(func(service *Service, logger *zap.Logger, auditService *security.AuditService, db *gorm.DB) *APIHandler {
		return NewAPIHandler(service, logger, auditService, db)
	}),
)
