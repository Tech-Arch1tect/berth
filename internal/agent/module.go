package agent

import (
	"berth/internal/config"

	"go.uber.org/fx"
	"go.uber.org/zap"
)

var Module = fx.Options(
	fx.Provide(func(logger *zap.Logger, cfg *config.Config) *Service {
		return NewService(logger, cfg.Custom.OperationTimeoutSeconds)
	}),
)
