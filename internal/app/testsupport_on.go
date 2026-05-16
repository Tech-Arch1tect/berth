//go:build e2e

package app

import (
	"berth/internal/domain/testsupport"
)

func wireTestSupport(g *Graph) error {
	models := testsupport.DatabaseModels(DatabaseModels())

	svc := testsupport.NewService(g.DB, g.AuthSvc, g.RBACSvc, g.Crypto, models, nil, g.Logger)
	h := testsupport.NewHandler(svc)
	testsupport.RegisterRoutes(g.Echo, h, g.Cfg)
	return nil
}
