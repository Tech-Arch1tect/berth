package operations

import (
	"berth/internal/rbac"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewAuditServiceWithDeps),
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewWebSocketHandler),
	fx.Provide(NewHandler),
)

func NewAuditServiceWithDeps(db *gorm.DB, logger *logging.Service) *AuditService {
	return NewAuditService(db, logger)
}

func NewServiceWithDeps(serverSvc *server.Service, rbacSvc *rbac.Service, auditSvc *AuditService, logger *logging.Service) *Service {
	return NewService(serverSvc, rbacSvc, auditSvc, logger)
}
