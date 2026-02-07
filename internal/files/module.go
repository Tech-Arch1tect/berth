package files

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
	fx.Provide(func(db *gorm.DB, service *Service, auditSvc *security.AuditService) *APIHandler {
		return NewAPIHandler(db, service, auditSvc)
	}),
)
