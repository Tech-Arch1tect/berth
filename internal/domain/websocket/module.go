package websocket

import (
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	"berth/internal/pkg/origin"

	"go.uber.org/fx"
	"go.uber.org/zap"
)

var Module = fx.Options(
	fx.Provide(func(rbacService *rbac.Service) PermissionChecker {
		return NewRBACPermissionChecker(rbacService)
	}),
	fx.Provide(func(permissionChecker PermissionChecker, logger *zap.Logger, checkOrigin origin.CheckOriginFunc) *Hub {
		return NewHub(permissionChecker, logger, checkOrigin)
	}),
	fx.Provide(NewHandler),
	fx.Provide(func(hub *Hub, logger *zap.Logger) *AgentManager {
		return NewAgentManager(hub, logger)
	}),
	fx.Provide(func(serverService *server.Service, agentManager *AgentManager, logger *zap.Logger) *ServiceManager {
		return NewServiceManager(serverService, agentManager, logger)
	}),
	fx.Invoke(startHub),
	fx.Invoke(StartWebSocketServiceManager),
)

func startHub(hub *Hub) {
	go hub.Run()
}
