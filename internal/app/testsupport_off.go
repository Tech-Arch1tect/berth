//go:build !e2e

package app

import "go.uber.org/fx"

func testSupportModule() fx.Option {
	return fx.Options()
}
