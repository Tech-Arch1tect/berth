package operations

import (
	"berth/internal/rbac"
	"berth/internal/server"

	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(NewAuditService),
	fx.Provide(NewServiceWithDeps),
	fx.Provide(NewWebSocketHandler),
	fx.Provide(NewHandler),
)

func NewServiceWithDeps(serverSvc *server.Service, rbacSvc *rbac.Service, auditSvc *AuditService) *Service {
	return NewService(serverSvc, rbacSvc, auditSvc)
}
