package security

import "go.uber.org/fx"

var Module = fx.Options(
	fx.Provide(NewAuditService),
	fx.Provide(NewHandler),
)
