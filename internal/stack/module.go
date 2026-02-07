package stack

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/security"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
		return NewService(agentSvc, serverSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(func(service *Service, logger *logging.Service, auditService *security.AuditService, db *gorm.DB) *APIHandler {
		return NewAPIHandler(service, logger, auditService, db)
	}),
)
