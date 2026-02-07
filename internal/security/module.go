package security

import (
	"context"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

var Module = fx.Options(
	fx.Provide(NewAuditService),
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
			p.Logger.Info("closing security audit logger")
			if err := p.AuditLogger.Close(); err != nil {
				p.Logger.Error("failed to close security audit logger", zap.Error(err))
				return err
			}
			p.Logger.Info("security audit logger closed successfully")
			return nil
		},
	})
}
