package websocket

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"berth/internal/domain/server"

	"github.com/coder/websocket"
	"go.uber.org/zap"
)

const agentReadLimit = 1 << 20

type AgentClient struct {
	server    *server.Server
	conn      *websocket.Conn
	registry  *StackEventRegistry
	reconnect chan bool
	stop      chan bool
	connected bool
	mutex     sync.RWMutex
	logger    *zap.Logger
}

type AgentManager struct {
	clients  map[uint]*AgentClient
	registry *StackEventRegistry
	mutex    sync.RWMutex
	logger   *zap.Logger
}

func NewAgentManager(registry *StackEventRegistry, logger *zap.Logger) *AgentManager {
	return &AgentManager{
		clients:  make(map[uint]*AgentClient),
		registry: registry,
		logger:   logger,
	}
}

func (am *AgentManager) ConnectToAgent(server *server.Server) error {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	if _, exists := am.clients[server.ID]; exists {
		am.logger.Debug("agent connection already exists",
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return nil
	}

	am.logger.Debug("creating new agent connection",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.String("server_host", server.Host),
		zap.Int("server_port", server.Port),
	)

	client := &AgentClient{
		server:    server,
		registry:  am.registry,
		reconnect: make(chan bool, 1),
		stop:      make(chan bool, 1),
		connected: false,
		logger:    am.logger,
	}

	am.clients[server.ID] = client
	go client.connect()

	return nil
}

func (am *AgentManager) DisconnectAgent(serverID uint) {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	if client, exists := am.clients[serverID]; exists {
		am.logger.Debug("disconnecting agent",
			zap.Uint("server_id", serverID),
			zap.String("server_name", client.server.Name),
		)
		client.stop <- true
		delete(am.clients, serverID)
	}
}

func (am *AgentManager) GetConnectionStatus(serverID uint) bool {
	am.mutex.RLock()
	defer am.mutex.RUnlock()

	if client, exists := am.clients[serverID]; exists {
		client.mutex.RLock()
		defer client.mutex.RUnlock()
		return client.connected
	}
	return false
}

func (ac *AgentClient) connect() {
	for {
		select {
		case <-ac.stop:
			ac.closeConn(websocket.StatusNormalClosure, "shutting down")
			return
		default:
			if err := ac.attemptConnection(); err != nil {
				ac.logger.Warn("failed to connect to agent",
					zap.Error(err),
					zap.Uint("server_id", ac.server.ID),
					zap.String("server_name", ac.server.Name),
					zap.String("server_host", ac.server.Host),
					zap.Int("server_port", ac.server.Port),
				)
				time.Sleep(5 * time.Second)
				continue
			}

			connCtx, connCancel := context.WithCancel(context.Background())
			go ac.readPump(connCtx)
			go ac.pingPump(connCtx)

			select {
			case <-ac.reconnect:
				connCancel()
				ac.closeConn(websocket.StatusGoingAway, "reconnecting")
				ac.setConnected(false)
				time.Sleep(1 * time.Second)
			case <-ac.stop:
				connCancel()
				ac.closeConn(websocket.StatusNormalClosure, "shutting down")
				return
			}
		}
	}
}

func (ac *AgentClient) closeConn(code websocket.StatusCode, reason string) {
	if ac.conn != nil {
		_ = ac.conn.Close(code, reason)
	}
}

func (ac *AgentClient) attemptConnection() error {
	wsURL := fmt.Sprintf("wss://%s:%d/ws/agent/status", ac.server.Host, ac.server.Port)

	ac.logger.Debug("attempting WebSocket connection to agent",
		zap.String("url", wsURL),
		zap.Uint("server_id", ac.server.ID),
		zap.String("server_name", ac.server.Name),
	)

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", ac.server.AccessToken))

	dialCtx, dialCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer dialCancel()

	dialOpts := &websocket.DialOptions{HTTPHeader: headers}
	if ac.server.SkipSSLVerification != nil && *ac.server.SkipSSLVerification {
		ac.logger.Debug("SSL verification disabled for WebSocket connection",
			zap.String("server_name", ac.server.Name),
		)
		dialOpts.HTTPClient = &http.Client{
			Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		}
	}

	conn, _, err := websocket.Dial(dialCtx, wsURL, dialOpts)
	if err != nil {
		return err
	}
	conn.SetReadLimit(agentReadLimit)

	ac.conn = conn
	ac.setConnected(true)

	ac.logger.Info("WebSocket connection established",
		zap.Uint("server_id", ac.server.ID),
		zap.String("server_name", ac.server.Name),
		zap.String("url", wsURL),
	)

	return nil
}

func (ac *AgentClient) readPump(ctx context.Context) {
	defer func() {
		ac.closeConn(websocket.StatusInternalError, "read loop ended")
		ac.setConnected(false)
		select {
		case ac.reconnect <- true:
		default:
		}
	}()

	for {
		_, message, err := ac.conn.Read(ctx)
		if err != nil {
			status := websocket.CloseStatus(err)
			if status == websocket.StatusNormalClosure || status == websocket.StatusGoingAway || ctx.Err() != nil {
				ac.logger.Debug("WebSocket connection closed",
					zap.Uint("server_id", ac.server.ID),
					zap.String("server_name", ac.server.Name),
				)
			} else {
				ac.logger.Error("WebSocket error from agent",
					zap.Error(err),
					zap.Uint("server_id", ac.server.ID),
					zap.String("server_name", ac.server.Name),
				)
			}
			break
		}

		ac.handleAgentMessage(message)
	}
}

func (ac *AgentClient) pingPump(ctx context.Context) {
	ticker := time.NewTicker(54 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pingCtx, pingCancel := context.WithTimeout(ctx, 10*time.Second)
			err := ac.conn.Ping(pingCtx)
			pingCancel()
			if err != nil {
				ac.closeConn(websocket.StatusGoingAway, "ping failed")
				return
			}
		}
	}
}

func (ac *AgentClient) handleAgentMessage(message []byte) {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {
		ac.logger.Error("invalid message from agent",
			zap.Error(err),
			zap.Uint("server_id", ac.server.ID),
			zap.String("server_name", ac.server.Name),
			zap.Int("message_length", len(message)),
		)
		return
	}

	ac.logger.Debug("received message from agent",
		zap.String("message_type", string(baseMsg.Type)),
		zap.Uint("server_id", ac.server.ID),
		zap.String("server_name", ac.server.Name),
	)

	switch baseMsg.Type {
	case MessageTypeContainerStatus:
		var event ContainerStatusEvent
		if err := json.Unmarshal(message, &event); err != nil {
			ac.logger.Error("invalid container status event from agent",
				zap.Error(err),
				zap.Uint("server_id", ac.server.ID),
				zap.String("server_name", ac.server.Name),
			)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.registry.PublishContainerStatus(event)

	case MessageTypeStackStatus:
		var event StackStatusEvent
		if err := json.Unmarshal(message, &event); err != nil {
			ac.logger.Error("invalid stack status event from agent",
				zap.Error(err),
				zap.Uint("server_id", ac.server.ID),
				zap.String("server_name", ac.server.Name),
			)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.registry.PublishStackStatus(event)

	case MessageTypeOperationProgress:
		ac.logger.Debug("dropping operation progress message from agent",
			zap.Uint("server_id", ac.server.ID),
			zap.String("server_name", ac.server.Name),
		)

	default:
		ac.logger.Warn("unknown message type from agent",
			zap.String("message_type", string(baseMsg.Type)),
			zap.Uint("server_id", ac.server.ID),
			zap.String("server_name", ac.server.Name),
		)
	}
}

func (ac *AgentClient) setConnected(connected bool) {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()
	ac.connected = connected
}
