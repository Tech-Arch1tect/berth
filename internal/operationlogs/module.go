package operationlogs

import (
	"berth/internal/pkg/config"

	"berth/internal/inertia"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewHandlerWithDeps),
)

func NewServiceWithDeps(db *gorm.DB, logger *zap.Logger) *Service {
	return NewService(db, logger)
}

func NewHandlerWithDeps(db *gorm.DB, service *Service, inertiaSvc *inertia.Service, logger *zap.Logger, cfg *config.Config) *Handler {
	return NewHandler(db, service, inertiaSvc, logger, cfg.Custom.OperationTimeoutSeconds)
}
