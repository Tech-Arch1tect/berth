package websocket

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"berth/internal/common"
	"berth/internal/operations"
	"berth/internal/server"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	hub           *Hub
	jwtService    *jwt.Service
	permChecker   PermissionChecker
	serverService *server.Service
	auditService  *operations.AuditService
}

func NewHandler(hub *Hub, jwtService *jwt.Service, permChecker PermissionChecker, serverService *server.Service, auditService *operations.AuditService) *Handler {
	return &Handler{
		hub:           hub,
		jwtService:    jwtService,
		permChecker:   permChecker,
		serverService: serverService,
		auditService:  auditService,
	}
}

func (h *Handler) HandleWebUIWebSocket(c echo.Context) error {
	userID, _, err := h.authenticateWebSocketRequest(c, "WebUI")
	if err != nil {
		return err
	}

	wsUser := &User{
		ID:   userID,
		Name: "",
	}

	return h.hub.ServeWebSocket(c, wsUser)
}

func (h *Handler) HandleFlutterWebSocket(c echo.Context) error {
	userID, _, err := h.authenticateWebSocketRequest(c, "Flutter")
	if err != nil {
		return err
	}

	wsUser := &User{
		ID:   userID,
		Name: "",
	}

	return h.hub.ServeWebSocket(c, wsUser)
}

func (h *Handler) HandleFlutterTerminalWebSocket(c echo.Context) error {

	userID, serverID, err := h.authenticateTerminalRequest(c, "Flutter")
	if err != nil {
		return err
	}

	return h.proxyTerminalConnection(c, serverID, "Flutter", userID)
}

func (h *Handler) HandleWebUITerminalWebSocket(c echo.Context) error {

	userID, serverID, err := h.authenticateTerminalRequest(c, "WebUI")
	if err != nil {
		return err
	}

	return h.proxyTerminalConnection(c, serverID, "WebUI", userID)
}

func (h *Handler) authenticateWebSocketRequest(c echo.Context, clientType string) (int, int, error) {
	var userID int

	if clientType == "Flutter" {
		auth := c.Request().Header.Get("Authorization")
		token, ok := strings.CutPrefix(auth, "Bearer ")
		if !ok || token == "" {
			return 0, 0, common.SendUnauthorized(c, "Authorization header with Bearer token required")
		}

		claims, err := h.jwtService.ValidateToken(token)
		if err != nil {
			return 0, 0, common.SendUnauthorized(c, "Invalid token")
		}
		userID = int(claims.UserID)
	} else {
		sessionUserID := session.GetUserIDAsUint(c)
		if sessionUserID == 0 {
			return 0, 0, common.SendUnauthorized(c, "Not authenticated")
		}
		userID = int(sessionUserID)
	}

	serverIDStr := c.Param("server_id")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {
		return 0, 0, common.SendBadRequest(c, "Invalid server ID")
	}

	if !h.permChecker.CanUserAccessServer(context.Background(), userID, serverID) {
		return 0, 0, common.SendForbidden(c, "Insufficient permissions to access this server")
	}

	return userID, serverID, nil
}

func (h *Handler) authenticateTerminalRequest(c echo.Context, clientType string) (int, int, error) {
	var userID int

	if clientType == "Flutter" {

		if authUserID, ok := c.Get("_jwt_user_id").(uint); ok && authUserID > 0 {
			userID = int(authUserID)
		} else {

			auth := c.Request().Header.Get("Authorization")
			token, ok := strings.CutPrefix(auth, "Bearer ")
			if !ok || token == "" {
				return 0, 0, common.SendUnauthorized(c, "Authorization header with Bearer token required")
			}

			claims, err := h.jwtService.ValidateToken(token)
			if err != nil {
				return 0, 0, common.SendUnauthorized(c, "Invalid token")
			}
			userID = int(claims.UserID)
		}
	} else {
		sessionUserID := session.GetUserIDAsUint(c)
		if sessionUserID == 0 {

			return 0, 0, common.SendUnauthorized(c, "Not authenticated")
		}
		userID = int(sessionUserID)
	}

	serverIDStr := c.Param("serverid")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {

		return 0, 0, common.SendBadRequest(c, "Invalid server ID")
	}

	if !h.permChecker.CanUserAccessServer(context.Background(), userID, serverID) {

		return 0, 0, common.SendForbidden(c, "Insufficient permissions to access this server")
	}

	return userID, serverID, nil
}

const (
	terminalPingInterval = 30 * time.Second
	terminalPongWait     = 60 * time.Second
	terminalWriteWait    = 10 * time.Second
)

func (h *Handler) proxyTerminalConnection(c echo.Context, serverID int, clientType string, userID int) error {

	server, err := h.serverService.GetServer(uint(serverID))
	if err != nil {

		return common.SendNotFound(c, "Server not found")
	}

	agentWSURL := fmt.Sprintf("wss://%s:%d/ws/terminal", server.Host, server.Port)

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", server.AccessToken))

	agentConn, _, err := dialer.Dial(agentWSURL, headers)
	if err != nil {

		return common.SendError(c, 502, "Failed to connect to agent terminal")
	}

	defer func() { _ = agentConn.Close() }()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	clientConn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer func() { _ = clientConn.Close() }()

	done := make(chan struct{})
	sessionStackName := ""
	var operationLogID *uint
	sessionStartTime := time.Now()

	_ = clientConn.SetReadDeadline(time.Now().Add(terminalPongWait))
	clientConn.SetPongHandler(func(string) error {
		_ = clientConn.SetReadDeadline(time.Now().Add(terminalPongWait))
		return nil
	})

	_ = agentConn.SetReadDeadline(time.Now().Add(terminalPongWait))
	agentConn.SetPongHandler(func(string) error {
		_ = agentConn.SetReadDeadline(time.Now().Add(terminalPongWait))
		return nil
	})

	go func() {
		ticker := time.NewTicker(terminalPingInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				_ = clientConn.SetWriteDeadline(time.Now().Add(terminalWriteWait))
				if err := clientConn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}

				_ = agentConn.SetWriteDeadline(time.Now().Add(terminalWriteWait))
				if err := agentConn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	go func() {
		defer func() {
			select {
			case <-done:
			default:
				close(done)
			}
		}()
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				break
			}

			if messageType == websocket.TextMessage {
				if !h.validateMessagePermissions(userID, serverID, message, &sessionStackName, clientType, clientConn, &operationLogID, sessionStartTime) {
					continue
				}
			}

			_ = agentConn.SetWriteDeadline(time.Now().Add(terminalWriteWait))
			if err := agentConn.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	}()

	go func() {
		defer func() {
			select {
			case <-done:
			default:
				close(done)
			}
		}()
		for {
			messageType, message, err := agentConn.ReadMessage()
			if err != nil {
				break
			}
			_ = clientConn.SetWriteDeadline(time.Now().Add(terminalWriteWait))
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	}()

	<-done

	if operationLogID != nil {
		endTime := time.Now()
		_ = h.auditService.LogOperationEnd(*operationLogID, endTime, true, 0)
	}

	return nil
}

type TerminalStartMessage struct {
	Type          string `json:"type"`
	StackName     string `json:"stack_name"`
	ServiceName   string `json:"service_name"`
	ContainerName string `json:"container_name"`
}

type TerminalInputMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
}

type TerminalResizeMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
}

type TerminalCloseMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
}

func (h *Handler) validateMessagePermissions(userID int, serverID int, message []byte, sessionStackName *string, clientType string, clientConn *websocket.Conn, operationLogID **uint, sessionStartTime time.Time) bool {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {

		h.sendTerminalError(clientConn, "Invalid message format", clientType)
		return false
	}

	switch baseMsg.Type {
	case "terminal_start":
		var startMsg TerminalStartMessage
		if err := json.Unmarshal(message, &startMsg); err != nil {

			h.sendTerminalError(clientConn, "Invalid terminal_start message format", clientType)
			return false
		}

		if startMsg.StackName == "" {

			h.sendTerminalError(clientConn, "stack_name is required for terminal access", clientType)
			return false
		}

		if !h.permChecker.HasStackPermission(context.Background(), userID, serverID, startMsg.StackName, "manage") {

			h.sendTerminalError(clientConn, fmt.Sprintf("Insufficient permissions: stacks.manage required for stack '%s'", startMsg.StackName), clientType)
			return false
		}

		*sessionStackName = startMsg.StackName

		operationID := fmt.Sprintf("terminal-%d-%d", time.Now().Unix(), userID)
		containerInfo := startMsg.ServiceName
		if startMsg.ContainerName != "" {
			containerInfo = fmt.Sprintf("%s/%s", startMsg.ServiceName, startMsg.ContainerName)
		}

		opRequest := operations.OperationRequest{
			Command:  "terminal",
			Options:  []string{containerInfo},
			Services: []string{},
		}

		log, err := h.auditService.LogOperationStart(
			uint(userID),
			uint(serverID),
			startMsg.StackName,
			operationID,
			opRequest,
			sessionStartTime,
		)
		if err == nil && log != nil {
			*operationLogID = &log.ID
		}

		return true

	case "terminal_input", "terminal_resize", "terminal_close":
		if *sessionStackName == "" {

			h.sendTerminalError(clientConn, "No active terminal session", clientType)
			return false
		}

		if !h.permChecker.HasStackPermission(context.Background(), userID, serverID, *sessionStackName, "manage") {

			h.sendTerminalError(clientConn, fmt.Sprintf("Insufficient permissions: stacks.manage required for stack '%s'", *sessionStackName), clientType)
			return false
		}

		return true

	default:

		h.sendTerminalError(clientConn, "Unknown message type", clientType)
		return false
	}
}

func (h *Handler) sendTerminalError(conn *websocket.Conn, message string, clientType string) {
	errorResponse := map[string]any{
		"type":      "error",
		"error":     message,
		"timestamp": time.Now(),
	}

	_ = conn.WriteJSON(errorResponse)
}
