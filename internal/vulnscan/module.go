package vulnscan

import (
	"context"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewService),
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
