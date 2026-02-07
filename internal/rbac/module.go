package rbac

import "go.uber.org/fx"

var Module = fx.Options(
	fx.Provide(NewService),
	fx.Provide(NewMiddleware),
	fx.Provide(NewRBACHandler),
	fx.Provide(NewAPIHandler),
)
