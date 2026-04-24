package server

import (
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(NewHandler),
	fx.Provide(NewAPIHandler),
	fx.Provide(NewUserAPIHandler),
)
