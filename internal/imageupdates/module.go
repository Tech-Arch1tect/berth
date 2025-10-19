package imageupdates

import (
	"berth/internal/rbac"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(NewService),
	fx.Provide(
		func(svc *Service, rbacSvc *rbac.Service, logger *logging.Service) *APIHandler {
			return NewAPIHandler(svc, rbacSvc, logger)
		},
	),
)
