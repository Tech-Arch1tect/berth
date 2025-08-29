package operations

import (
	"berth/internal/rbac"
	"berth/internal/server"

	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewWebSocketHandler),
	fx.Provide(NewHandler),
)

func NewServiceWithDeps(serverSvc *server.Service, rbacSvc *rbac.Service) *Service {
	return NewService(serverSvc, rbacSvc)
}
