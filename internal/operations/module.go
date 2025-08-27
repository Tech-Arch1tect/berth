package operations

import (
	"brx-starter-kit/internal/rbac"
	"brx-starter-kit/internal/server"

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
