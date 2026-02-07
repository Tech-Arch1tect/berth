package websocket

import (
	"berth/models"
	"context"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

type wsServerProvider interface {
	ListServers() ([]models.ServerInfo, error)
	GetServer(id uint) (*models.Server, error)
}

type ServiceManager struct {
	serverService wsServerProvider
	agentManager  *AgentManager
	logger        *logging.Service
}

func NewServiceManager(serverService wsServerProvider, agentManager *AgentManager, logger *logging.Service) *ServiceManager {
	return &ServiceManager{
		serverService: serverService,
		agentManager:  agentManager,
		logger:        logger,
	}
}

func (sm *ServiceManager) Start() error {
	sm.logger.Info("starting WebSocket service manager")

	servers, err := sm.serverService.ListServers()
	if err != nil {
		sm.logger.Error("failed to list servers during WebSocket service startup",
			zap.Error(err),
		)
		return err
	}

	sm.logger.Debug("connecting to WebSocket agents",
		zap.Int("server_count", len(servers)),
	)

	successfulConnections := 0
	for _, serverResp := range servers {
		server, err := sm.serverService.GetServer(serverResp.ID)
		if err != nil {
			sm.logger.Error("failed to get server details for WebSocket connection",
				zap.Error(err),
				zap.Uint("server_id", serverResp.ID),
			)
			continue
		}

		if err := sm.agentManager.ConnectToAgent(server); err != nil {
			sm.logger.Warn("failed to connect to WebSocket agent",
				zap.Error(err),
				zap.Uint("server_id", server.ID),
				zap.String("server_name", server.Name),
				zap.String("server_host", server.Host),
				zap.Int("server_port", server.Port),
			)
			continue
		}

		sm.logger.Debug("WebSocket agent connected successfully",
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		successfulConnections++
	}

	sm.logger.Info("WebSocket service manager startup completed",
		zap.Int("total_servers", len(servers)),
		zap.Int("successful_connections", successfulConnections),
		zap.Int("failed_connections", len(servers)-successfulConnections),
	)

	return nil
}

func StartWebSocketServiceManager(lc fx.Lifecycle, sm *ServiceManager) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go func() {
				if err := sm.Start(); err != nil {
					sm.logger.Error("WebSocket service manager startup failed",
						zap.Error(err),
					)
				}
			}()
			return nil
		},
	})
}
