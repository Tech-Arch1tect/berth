package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Hub struct {
	clients           map[*UserConnection]bool
	register          chan *UserConnection
	unregister        chan *UserConnection
	subscriptionMgr   *SubscriptionManager
	mutex             sync.RWMutex
	permissionChecker PermissionChecker
	logger            *logging.Service
}

type UserConnection struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan []byte
	user          *User
	subscriptions map[SubscriptionKey]bool
}

type PermissionChecker interface {
	CanUserAccessServer(ctx context.Context, userID int, serverID int) bool
	CanUserAccessAnyStackWithPermission(ctx context.Context, userID int, serverID int, permission string) bool
	HasStackPermission(ctx context.Context, userID int, serverID int, stackname string, permission string) bool
}

func NewHub(permissionChecker PermissionChecker, logger *logging.Service) *Hub {
	return &Hub{
		register:          make(chan *UserConnection),
		unregister:        make(chan *UserConnection),
		clients:           make(map[*UserConnection]bool),
		subscriptionMgr:   NewSubscriptionManager(),
		permissionChecker: permissionChecker,
		logger:            logger,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				h.subscriptionMgr.UnsubscribeAll(client)
				delete(h.clients, client)
				close(client.send)
			}
			h.mutex.Unlock()
		}
	}
}

func (h *Hub) BroadcastContainerStatus(event ContainerStatusEvent) {
	event.BaseMessage = BaseMessage{
		Type:      MessageTypeContainerStatus,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	subscribers := h.subscriptionMgr.GetSubscribers("stack_status", event.ServerID, event.StackName)

	data, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("error marshalling container status event",
			zap.Error(err),
			zap.Int("server_id", event.ServerID),
			zap.String("stack_name", event.StackName),
			zap.String("container_name", event.ContainerName),
		)
		return
	}

	ctx := context.Background()
	for _, client := range subscribers {
		if h.permissionChecker.CanUserAccessServer(ctx, client.user.ID, event.ServerID) {
			if h.permissionChecker.HasStackPermission(ctx, client.user.ID, event.ServerID, event.StackName, "view") {
				select {
				case client.send <- data:
				default:
					h.unregister <- client
				}
			}
		}
	}
}

func (h *Hub) BroadcastOperationProgress(event OperationProgressEvent) {
	event.BaseMessage = BaseMessage{
		Type:      MessageTypeOperationProgress,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	subscribers := h.subscriptionMgr.GetSubscribers("operations", event.ServerID, "")

	data, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("error marshalling operation progress event",
			zap.Error(err),
			zap.Int("server_id", event.ServerID),
			zap.String("stack_name", event.StackName),
			zap.String("operation", event.Operation),
		)
		return
	}

	ctx := context.Background()
	for _, client := range subscribers {
		if h.permissionChecker.CanUserAccessServer(ctx, client.user.ID, event.ServerID) {
			if h.permissionChecker.CanUserAccessAnyStackWithPermission(ctx, client.user.ID, event.ServerID, "manage") {
				select {
				case client.send <- data:
				default:
					h.unregister <- client
				}
			}
		}
	}
}

func (h *Hub) BroadcastStackStatus(event StackStatusEvent) {
	event.BaseMessage = BaseMessage{
		Type:      MessageTypeStackStatus,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	subscribers := h.subscriptionMgr.GetSubscribers("stack_status", event.ServerID, event.StackName)

	data, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("error marshalling stack status event",
			zap.Error(err),
			zap.Int("server_id", event.ServerID),
			zap.String("stack_name", event.StackName),
			zap.String("status", event.Status),
		)
		return
	}

	ctx := context.Background()
	for _, client := range subscribers {
		if h.permissionChecker.CanUserAccessServer(ctx, client.user.ID, event.ServerID) {
			if h.permissionChecker.HasStackPermission(ctx, client.user.ID, event.ServerID, event.StackName, "view") {
				select {
				case client.send <- data:
				default:
					h.unregister <- client
				}
			}
		}
	}
}

func (h *Hub) ServeWebSocket(c echo.Context, user *User) error {
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		h.logger.Error("WebSocket upgrade error",
			zap.Error(err),
			zap.Int("user_id", user.ID),
			zap.String("user_name", user.Name),
		)
		return err
	}

	h.logger.Info("WebSocket connection established",
		zap.Int("user_id", user.ID),
		zap.String("user_name", user.Name),
		zap.String("remote_addr", c.Request().RemoteAddr),
	)

	client := &UserConnection{
		hub:           h,
		conn:          conn,
		send:          make(chan []byte, 256),
		user:          user,
		subscriptions: make(map[SubscriptionKey]bool),
	}

	client.hub.register <- client

	go client.writePump()
	go client.readPump()

	return nil
}

func (c *UserConnection) readPump() {
	defer func() {
		c.hub.unregister <- c
		_ = c.conn.Close()
	}()

	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.logger.Error("WebSocket error",
					zap.Error(err),
					zap.Int("user_id", c.user.ID),
					zap.String("user_name", c.user.Name),
				)
			} else {
				c.hub.logger.Debug("WebSocket connection closed",
					zap.Int("user_id", c.user.ID),
					zap.String("user_name", c.user.Name),
				)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *UserConnection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			_ = c.conn.WriteMessage(websocket.TextMessage, message)

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *UserConnection) handleMessage(message []byte) {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {
		c.sendError("Invalid message format")
		return
	}

	switch baseMsg.Type {
	case MessageTypeSubscribe:
		var subMsg SubscribeMessage
		if err := json.Unmarshal(message, &subMsg); err != nil {
			c.sendError("Invalid subscribe message")
			return
		}
		c.handleSubscribe(subMsg)

	case MessageTypeUnsubscribe:
		var unsubMsg UnsubscribeMessage
		if err := json.Unmarshal(message, &unsubMsg); err != nil {
			c.sendError("Invalid unsubscribe message")
			return
		}
		c.handleUnsubscribe(unsubMsg)

	default:
		c.sendError("Unknown message type")
	}
}

func (c *UserConnection) handleSubscribe(msg SubscribeMessage) {
	ctx := context.Background()

	if !c.hub.permissionChecker.CanUserAccessServer(ctx, c.user.ID, msg.ServerID) {
		c.sendError("Access denied to server")
		return
	}

	if msg.Resource == "stack_status" && msg.StackName != "" && !c.hub.permissionChecker.HasStackPermission(ctx, c.user.ID, msg.ServerID, msg.StackName, "view") {
		c.sendError("Permission denied for stack viewing")
		return
	}

	if msg.Resource == "stack_status" && msg.StackName == "" && !c.hub.permissionChecker.CanUserAccessAnyStackWithPermission(ctx, c.user.ID, msg.ServerID, "view") {
		c.sendError("Permission denied for stack viewing")
		return
	}

	if msg.Resource == "operations" && !c.hub.permissionChecker.CanUserAccessAnyStackWithPermission(ctx, c.user.ID, msg.ServerID, "manage") {
		c.sendError("Permission denied for stack operations")
		return
	}

	if msg.Resource == "logs" && msg.StackName != "" && !c.hub.permissionChecker.HasStackPermission(ctx, c.user.ID, msg.ServerID, msg.StackName, "view") {
		c.sendError("Permission denied for log viewing")
		return
	}

	if msg.Resource == "logs" && msg.StackName == "" && !c.hub.permissionChecker.CanUserAccessAnyStackWithPermission(ctx, c.user.ID, msg.ServerID, "view") {
		c.sendError("Permission denied for log viewing")
		return
	}

	c.hub.subscriptionMgr.Subscribe(c, msg.Resource, msg.ServerID, msg.StackName)
	c.sendSuccess("Subscribed successfully")
}

func (c *UserConnection) handleUnsubscribe(msg UnsubscribeMessage) {
	c.hub.subscriptionMgr.Unsubscribe(c, msg.Resource, msg.ServerID, msg.StackName)
	c.sendSuccess("Unsubscribed successfully")
}

func (c *UserConnection) sendError(errorMsg string) {
	event := ErrorEvent{
		BaseMessage: BaseMessage{
			Type:      MessageTypeError,
			Timestamp: time.Now().Format(time.RFC3339),
		},
		Error: errorMsg,
	}

	data, _ := json.Marshal(event)
	select {
	case c.send <- data:
	default:
		c.hub.unregister <- c
	}
}

func (c *UserConnection) sendSuccess(message string) {
	event := SuccessEvent{
		BaseMessage: BaseMessage{
			Type:      MessageTypeSuccess,
			Timestamp: time.Now().Format(time.RFC3339),
		},
		Message: message,
	}

	data, _ := json.Marshal(event)
	select {
	case c.send <- data:
	default:
		c.hub.unregister <- c
	}
}
