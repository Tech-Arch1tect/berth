package dashboard

import (
	"berth/internal/inertia"
	"berth/internal/server"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var Module = fx.Options(
	fx.Provide(func(inertiaSvc *inertia.Service, db *gorm.DB, logger *zap.Logger, serverSvc *server.Service) *Handler {
		return NewHandler(inertiaSvc, db, logger, serverSvc)
	}),
)
