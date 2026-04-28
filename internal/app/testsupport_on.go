//go:build e2e

package app

import (
	"berth/internal/domain/session"
	"berth/internal/domain/testsupport"
	"berth/internal/pkg/config"

	"go.uber.org/fx"
	"gorm.io/gorm"
)

func testSupportModule() fx.Option {
	return fx.Options(
		fx.Supply(testsupport.DatabaseModels(DatabaseModels())),
		fx.Provide(externalSchemaHooks),
		testsupport.Module,
	)
}

func externalSchemaHooks(cfg *config.Config) []testsupport.EnsureSchemaFunc {
	var hooks []testsupport.EnsureSchemaFunc
	if cfg.Session.Store == "database" {
		hooks = append(hooks, func(db *gorm.DB) error {
			return session.MigrateDatabaseStore(db)
		})
	}
	return hooks
}
