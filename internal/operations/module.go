package operations

import (
	"context"

	"berth/internal/files"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewSummaryParser),
	fx.Provide(NewAuditServiceWithDeps),
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewWebSocketHandler),
	fx.Provide(NewHandler),
	fx.Invoke(registerAuditLoggerShutdown),
)

type auditLoggerShutdownParams struct {
	fx.In
	LC          fx.Lifecycle
	AuditLogger *AuditLogger `optional:"true"`
	Logger      *logging.Service
}

func registerAuditLoggerShutdown(p auditLoggerShutdownParams) {
	if p.AuditLogger == nil {
		return
	}
	p.LC.Append(fx.Hook{
		OnStop: func(ctx context.Context) error {
			p.Logger.Info("closing operation log audit logger")
			if err := p.AuditLogger.Close(); err != nil {
				p.Logger.Error("failed to close operation audit logger", zap.Error(err))
				return err
			}
			p.Logger.Info("operation log audit logger closed successfully")
			return nil
		},
	})
}

func NewAuditServiceWithDeps(db *gorm.DB, logger *logging.Service, summaryParser *SummaryParser) *AuditService {
	return NewAuditService(db, logger, summaryParser)
}

func NewServiceWithDeps(serverSvc *server.Service, rbacSvc *rbac.Service, auditSvc *AuditService, registrySvc *registry.Service, filesSvc *files.Service, logger *logging.Service) *Service {
	return NewService(serverSvc, rbacSvc, auditSvc, registrySvc, filesSvc, logger)
}
