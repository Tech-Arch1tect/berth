package handlers

import "go.uber.org/fx"

var Module = fx.Options(
	fx.Provide(NewDashboardHandler),
	fx.Provide(NewStacksHandler),
	fx.Provide(NewAuthHandler),
	fx.Provide(NewMobileAuthHandler),
	fx.Provide(NewSessionHandler),
	fx.Provide(NewTOTPHandler),
	fx.Provide(NewVersionHandler),
)
