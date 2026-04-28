//go:build e2e

package app

import (
	"berth/internal/domain/testsupport"

	"go.uber.org/fx"
)

func testSupportModule() fx.Option {
	return fx.Options(
		fx.Supply(testsupport.DatabaseModels(DatabaseModels())),
		testsupport.Module,
	)
}
