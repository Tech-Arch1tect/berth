package websocket

import (
	"berth/internal/rbac"
	"berth/internal/server"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
)

var Module = fx.Options(
	fx.Provide(func(rbacService *rbac.Service) PermissionChecker {
		return NewRBACPermissionChecker(rbacService)
	}),
	fx.Provide(func(permissionChecker PermissionChecker, logger *logging.Service) *Hub {
		return NewHub(permissionChecker, logger)
	}),
	fx.Provide(NewHandler),
	fx.Provide(func(hub *Hub, logger *logging.Service) *AgentManager {
		return NewAgentManager(hub, logger)
	}),
	fx.Provide(func(serverService *server.Service, agentManager *AgentManager, logger *logging.Service) *ServiceManager {
		return NewServiceManager(serverService, agentManager, logger)
	}),
	fx.Invoke(startHub),
	fx.Invoke(StartWebSocketServiceManager),
)

func startHub(hub *Hub) {
	go hub.Run()
}
