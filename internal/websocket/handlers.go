package websocket

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"brx-starter-kit/internal/server"

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
}

func NewHandler(hub *Hub, jwtService *jwt.Service, permChecker PermissionChecker, serverService *server.Service) *Handler {
	return &Handler{
		hub:           hub,
		jwtService:    jwtService,
		permChecker:   permChecker,
		serverService: serverService,
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
			return 0, 0, c.JSON(401, map[string]string{
				"error": "Authorization header with Bearer token required",
			})
		}

		claims, err := h.jwtService.ValidateToken(token)
		if err != nil {
			return 0, 0, c.JSON(401, map[string]string{
				"error": "Invalid token",
			})
		}
		userID = int(claims.UserID)
	} else {
		sessionUserID := session.GetUserIDAsUint(c)
		if sessionUserID == 0 {
			return 0, 0, c.JSON(401, map[string]string{
				"error": "Not authenticated",
			})
		}
		userID = int(sessionUserID)
	}

	serverIDStr := c.Param("server_id")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {
		return 0, 0, c.JSON(400, map[string]string{
			"error": "Invalid server ID",
		})
	}

	if !h.permChecker.CanUserAccessServer(userID, serverID) {
		return 0, 0, c.JSON(403, map[string]string{
			"error": "Insufficient permissions to access this server",
		})
	}

	return userID, serverID, nil
}

func (h *Handler) authenticateTerminalRequest(c echo.Context, clientType string) (int, int, error) {
	var userID int

	if clientType == "Flutter" {
		auth := c.Request().Header.Get("Authorization")
		token, ok := strings.CutPrefix(auth, "Bearer ")
		if !ok || token == "" {

			return 0, 0, c.JSON(401, map[string]string{
				"error": "Authorization header with Bearer token required",
			})
		}

		claims, err := h.jwtService.ValidateToken(token)
		if err != nil {

			return 0, 0, c.JSON(401, map[string]string{
				"error": "Invalid token",
			})
		}
		userID = int(claims.UserID)
	} else {
		sessionUserID := session.GetUserIDAsUint(c)
		if sessionUserID == 0 {

			return 0, 0, c.JSON(401, map[string]string{
				"error": "Not authenticated",
			})
		}
		userID = int(sessionUserID)
	}

	serverIDStr := c.Param("serverId")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {

		return 0, 0, c.JSON(400, map[string]string{
			"error": "Invalid server ID",
		})
	}

	if !h.permChecker.CanUserAccessServer(userID, serverID) {

		return 0, 0, c.JSON(403, map[string]string{
			"error": "Insufficient permissions to access this server",
		})
	}

	return userID, serverID, nil
}

func (h *Handler) proxyTerminalConnection(c echo.Context, serverID int, clientType string, userID int) error {

	server, err := h.serverService.GetServer(uint(serverID))
	if err != nil {

		return c.JSON(404, map[string]string{
			"error": "Server not found",
		})
	}

	scheme := "ws"
	if server.UseHTTPS {
		scheme = "wss"
	}

	agentWSURL := fmt.Sprintf("%s://%s:%d/ws/terminal", scheme, server.Host, server.Port)

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", server.AccessToken))

	agentConn, _, err := dialer.Dial(agentWSURL, headers)
	if err != nil {

		return c.JSON(502, map[string]string{
			"error": "Failed to connect to agent terminal",
		})
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

	done := make(chan bool, 2)
	sessionStackName := ""

	go func() {
		defer func() {

			done <- true
		}()
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				break
			}

			if messageType == websocket.TextMessage {
				if !h.validateMessagePermissions(userID, serverID, message, &sessionStackName, clientType, clientConn) {
					continue
				}
			}

			if err := agentConn.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	}()

	go func() {
		defer func() {
			done <- true
		}()
		for {
			messageType, message, err := agentConn.ReadMessage()
			if err != nil {
				break
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	}()

	<-done
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

func (h *Handler) validateMessagePermissions(userID int, serverID int, message []byte, sessionStackName *string, clientType string, clientConn *websocket.Conn) bool {
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

		if !h.permChecker.HasStackPermission(userID, serverID, startMsg.StackName, "manage") {

			h.sendTerminalError(clientConn, fmt.Sprintf("Insufficient permissions: stacks.manage required for stack '%s'", startMsg.StackName), clientType)
			return false
		}

		*sessionStackName = startMsg.StackName

		return true

	case "terminal_input", "terminal_resize", "terminal_close":
		if *sessionStackName == "" {

			h.sendTerminalError(clientConn, "No active terminal session", clientType)
			return false
		}

		if !h.permChecker.HasStackPermission(userID, serverID, *sessionStackName, "manage") {

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
