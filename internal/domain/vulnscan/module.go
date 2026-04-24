package vulnscan

import (
	"berth/internal/domain/agent"
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	"context"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, serverSvc *server.Service, agentSvc *agent.Service, rbacSvc *rbac.Service, logger *zap.Logger) *Service {
		return NewService(db, serverSvc, agentSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(NewPoller),
)

func StartPoller(lc fx.Lifecycle, poller *Poller, logger *zap.Logger) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			poller.Start()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			poller.Stop()
			return nil
		},
	})
}

func NewPollerWithDeps(db *gorm.DB, service *Service, logger *zap.Logger) *Poller {
	return NewPoller(db, service, logger)
}
