package harness

import (
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(ProvideE2EApp),
	fx.Provide(ProvideTestConfig),
	fx.Provide(ProvideHTTPClient),
)
