package agent

import (
	berthconfig "berth/internal/config"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(func(logger *logging.Service, cfg *berthconfig.BerthConfig) *Service {
		return NewService(logger, cfg.Custom.OperationTimeoutSeconds)
	}),
)
