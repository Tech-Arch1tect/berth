//go:build e2e

package app

import (
	"berth/internal/domain/session"
	"berth/internal/domain/testsupport"

	"gorm.io/gorm"
)

func wireTestSupport(g *Graph) error {
	models := testsupport.DatabaseModels(DatabaseModels())
	hooks := externalSchemaHooks(g)

	svc := testsupport.NewService(g.DB, g.AuthSvc, g.RBACSvc, g.Crypto, models, hooks, g.Logger)
	h := testsupport.NewHandler(svc)
	testsupport.RegisterRoutes(g.Echo, h, g.Cfg)
	return nil
}

func externalSchemaHooks(g *Graph) []testsupport.EnsureSchemaFunc {
	var hooks []testsupport.EnsureSchemaFunc
	if g.Cfg.Session.Store == "database" {
		hooks = append(hooks, func(db *gorm.DB) error {
			return session.MigrateDatabaseStore(db)
		})
	}
	return hooks
}
