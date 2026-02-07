package logs

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(func(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
		return NewService(agentSvc, serverSvc, rbacSvc, logger)
	}),
	fx.Provide(NewHandler),
)
