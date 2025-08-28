package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"brx-starter-kit/models"
	"github.com/gorilla/websocket"
)

type AgentClient struct {
	server    *models.Server
	conn      *websocket.Conn
	hub       *Hub
	reconnect chan bool
	stop      chan bool
	connected bool
	mutex     sync.RWMutex
}

type AgentManager struct {
	clients map[uint]*AgentClient
	hub     *Hub
	mutex   sync.RWMutex
}

func NewAgentManager(hub *Hub) *AgentManager {
	return &AgentManager{
		clients: make(map[uint]*AgentClient),
		hub:     hub,
	}
}

func (am *AgentManager) ConnectToAgent(server *models.Server) error {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	if _, exists := am.clients[server.ID]; exists {
		return nil
	}

	client := &AgentClient{
		server:    server,
		hub:       am.hub,
		reconnect: make(chan bool, 1),
		stop:      make(chan bool, 1),
		connected: false,
	}

	am.clients[server.ID] = client
	go client.connect()

	return nil
}

func (am *AgentManager) DisconnectAgent(serverID uint) {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	if client, exists := am.clients[serverID]; exists {
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
				ac.conn.Close()
			}
			return
		default:
			if err := ac.attemptConnection(); err != nil {
				log.Printf("Failed to connect to agent %s: %v", ac.server.Name, err)
				time.Sleep(5 * time.Second)
				continue
			}

			go ac.readPump()
			go ac.writePump()

			select {
			case <-ac.reconnect:
				if ac.conn != nil {
					ac.conn.Close()
				}
				ac.setConnected(false)
				time.Sleep(1 * time.Second)
			case <-ac.stop:
				if ac.conn != nil {
					ac.conn.Close()
				}
				return
			}
		}
	}
}

func (ac *AgentClient) attemptConnection() error {
	wsURL := fmt.Sprintf("ws://%s:%d/ws/agent/status", ac.server.Host, ac.server.Port)

	headers := make(map[string][]string)
	headers["Authorization"] = []string{fmt.Sprintf("Bearer %s", ac.server.AccessToken)}

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		return err
	}

	ac.conn = conn
	ac.setConnected(true)
	return nil
}

func (ac *AgentClient) readPump() {
	defer func() {
		ac.conn.Close()
		ac.setConnected(false)
		select {
		case ac.reconnect <- true:
		default:
		}
	}()

	ac.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	ac.conn.SetPongHandler(func(string) error {
		ac.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := ac.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error from agent %s: %v", ac.server.Name, err)
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
		ac.conn.Close()
	}()

	for range ticker.C {
		ac.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := ac.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
			return
		}
	}
}

func (ac *AgentClient) handleAgentMessage(message []byte) {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {
		log.Printf("Invalid message from agent %s: %v", ac.server.Name, err)
		return
	}

	switch baseMsg.Type {
	case MessageTypeContainerStatus:
		var event ContainerStatusEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Printf("Invalid container status event from agent %s: %v", ac.server.Name, err)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.hub.BroadcastContainerStatus(event)

	case MessageTypeStackStatus:
		var event StackStatusEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Printf("Invalid stack status event from agent %s: %v", ac.server.Name, err)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.hub.BroadcastStackStatus(event)

	case MessageTypeOperationProgress:
		var event OperationProgressEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Printf("Invalid operation progress event from agent %s: %v", ac.server.Name, err)
			return
		}

		event.ServerID = int(ac.server.ID)
		ac.hub.BroadcastOperationProgress(event)

	default:
		log.Printf("Unknown message type from agent %s: %s", ac.server.Name, baseMsg.Type)
	}
}

func (ac *AgentClient) setConnected(connected bool) {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()
	ac.connected = connected
}
