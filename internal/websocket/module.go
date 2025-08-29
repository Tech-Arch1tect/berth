package websocket

import (
	"berth/internal/rbac"
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(func(rbacService *rbac.Service) PermissionChecker {
		return NewRBACPermissionChecker(rbacService)
	}),
	fx.Provide(NewHub),
	fx.Provide(NewHandler),
	fx.Provide(NewAgentManager),
	fx.Provide(NewServiceManager),
)
