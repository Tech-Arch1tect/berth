package websocket

import (
	"brx-starter-kit/internal/server"
	"context"
	"log"

	"go.uber.org/fx"
)

type ServiceManager struct {
	serverService *server.Service
	agentManager  *AgentManager
}

func NewServiceManager(serverService *server.Service, agentManager *AgentManager) *ServiceManager {
	return &ServiceManager{
		serverService: serverService,
		agentManager:  agentManager,
	}
}

func (sm *ServiceManager) Start() error {
	servers, err := sm.serverService.ListServers()
	if err != nil {
		return err
	}

	for _, serverResp := range servers {
		server, err := sm.serverService.GetServer(serverResp.ID)
		if err != nil {
			log.Printf("Failed to get server details for ID %d: %v", serverResp.ID, err)
			continue
		}

		if err := sm.agentManager.ConnectToAgent(server); err != nil {
			log.Printf("Failed to connect to agent for server %s: %v", server.Name, err)
			continue
		}
	}
	return nil
}

func StartWebSocketServiceManager(lc fx.Lifecycle, sm *ServiceManager) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go func() {
				if err := sm.Start(); err != nil {
					log.Printf("Failed to start WebSocket service manager: %v", err)
				}
			}()
			return nil
		},
	})
}
