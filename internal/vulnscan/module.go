package vulnscan

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"context"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(db *gorm.DB, serverSvc *server.Service, agentSvc *agent.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
		return NewService(db, serverSvc, agentSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(NewPoller),
)

func StartPoller(lc fx.Lifecycle, poller *Poller, logger *logging.Service) {
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

func NewPollerWithDeps(db *gorm.DB, service *Service, logger *logging.Service) *Poller {
	return NewPoller(db, service, logger)
}
