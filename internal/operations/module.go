package operations

import (
	"berth/internal/files"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewSummaryParser),
	fx.Provide(NewAuditServiceWithDeps),
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewWebSocketHandler),
	fx.Provide(NewHandler),
)

func NewAuditServiceWithDeps(db *gorm.DB, logger *logging.Service, summaryParser *SummaryParser) *AuditService {
	return NewAuditService(db, logger, summaryParser)
}

func NewServiceWithDeps(serverSvc *server.Service, rbacSvc *rbac.Service, auditSvc *AuditService, registrySvc *registry.Service, filesSvc *files.Service, logger *logging.Service) *Service {
	return NewService(serverSvc, rbacSvc, auditSvc, registrySvc, filesSvc, logger)
}
