package websocket

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"berth/models"
	"github.com/gorilla/websocket"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type AgentClient struct {
	server    *models.Server
	conn      *websocket.Conn
	hub       *Hub
	reconnect chan bool
	stop      chan bool
	connected bool
	mutex     sync.RWMutex
	logger    *logging.Service
}

type AgentManager struct {
	clients map[uint]*AgentClient
	hub     *Hub
	mutex   sync.RWMutex
	logger  *logging.Service
}

func NewAgentManager(hub *Hub, logger *logging.Service) *AgentManager {
	return &AgentManager{
		clients: make(map[uint]*AgentClient),
		hub:     hub,
		logger:  logger,
	}
}

func (am *AgentManager) ConnectToAgent(server *models.Server) error {
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
		hub:       am.hub,
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
			if ac.conn != nil {
				_ = ac.conn.Close()
			}
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

			go ac.readPump()
			go ac.writePump()

			select {
			case <-ac.reconnect:
				if ac.conn != nil {
					_ = ac.conn.Close()
				}
				ac.setConnected(false)
				time.Sleep(1 * time.Second)
			case <-ac.stop:
				if ac.conn != nil {
					_ = ac.conn.Close()
				}
				return
			}
		}
	}
}

func (ac *AgentClient) attemptConnection() error {
	wsURL := fmt.Sprintf("wss://%s:%d/ws/agent/status", ac.server.Host, ac.server.Port)

	ac.logger.Debug("attempting WebSocket connection to agent",
		zap.String("url", wsURL),
		zap.Uint("server_id", ac.server.ID),
		zap.String("server_name", ac.server.Name),
	)

	headers := make(map[string][]string)
	headers["Authorization"] = []string{fmt.Sprintf("Bearer %s", ac.server.AccessToken)}

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	if ac.server.SkipSSLVerification != nil && *ac.server.SkipSSLVerification {
		ac.logger.Debug("SSL verification disabled for WebSocket connection",
			zap.String("server_name", ac.server.Name),
		)
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		return err
	}

	ac.conn = conn
	ac.setConnected(true)

	ac.logger.Info("WebSocket connection established",
		zap.Uint("server_id", ac.server.ID),
		zap.String("server_name", ac.server.Name),
		zap.String("url", wsURL),
	)

	return nil
}

func (ac *AgentClient) readPump() {
	defer func() {
		_ = ac.conn.Close()
		ac.setConnected(false)
		select {
		case ac.reconnect <- true:
		default:
		}
	}()

	_ = ac.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	ac.conn.SetPongHandler(func(string) error {
		_ = ac.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := ac.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				ac.logger.Error("WebSocket error from agent",
					zap.Error(err),
					zap.Uint("server_id", ac.server.ID),
					zap.String("server_name", ac.server.Name),
				)
			} else {
				ac.logger.Debug("WebSocket connection closed",
					zap.Uint("server_id", ac.server.ID),
					zap.String("server_name", ac.server.Name),
				)
			}
			break
		}

		ac.handleAgentMessage(message)
	}
}

func (ac *AgentClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		_ = ac.conn.Close()
	}()

	for range ticker.C {
		_ = ac.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := ac.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
			return
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
		ac.hub.BroadcastContainerStatus(event)

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
		ac.hub.BroadcastStackStatus(event)

	case MessageTypeOperationProgress:
		var event OperationProgressEvent
		if err := json.Unmarshal(message, &event); err != nil {
			ac.logger.Error("invalid operation progress event from agent",
				zap.Error(err),
				zap.Uint("server_id", ac.server.ID),
				zap.String("server_name", ac.server.Name),
			)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.hub.BroadcastOperationProgress(event)

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
