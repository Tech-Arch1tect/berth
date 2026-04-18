package logs

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"

	"go.uber.org/fx"
	"go.uber.org/zap"
)

var Module = fx.Options(
	fx.Provide(func(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *zap.Logger) *Service {
		return NewService(agentSvc, serverSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
)
