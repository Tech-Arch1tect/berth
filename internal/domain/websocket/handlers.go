package websocket

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"berth/internal/domain/auth"
	"berth/internal/domain/operations"
	"berth/internal/domain/server"
	"berth/internal/pkg/origin"
	"berth/internal/pkg/response"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	serverService *server.Service
	auditService  *operations.AuditService
	checkOrigin   origin.CheckOriginFunc
}

func NewHandler(serverService *server.Service, auditService *operations.AuditService, checkOrigin origin.CheckOriginFunc) *Handler {
	return &Handler{
		serverService: serverService,
		auditService:  auditService,
		checkOrigin:   checkOrigin,
	}
}

func (h *Handler) HandleFlutterTerminalWebSocket(c echo.Context) error {
	userID := int(auth.GetUserID(c))
	serverID, err := strconv.Atoi(c.Param("serverid"))
	if err != nil {
		return response.BadRequest(c, "Invalid server ID")
	}
	stackName := c.Param("stackname")

	return h.proxyTerminalConnection(c, serverID, stackName, "Flutter", userID)
}

const (
	terminalPingInterval = 30 * time.Second
	terminalPongWait     = 60 * time.Second
	terminalWriteWait    = 10 * time.Second
)

func (h *Handler) proxyTerminalConnection(c echo.Context, serverID int, stackName string, clientType string, userID int) error {

	server, err := h.serverService.GetServer(uint(serverID))
	if err != nil {

		return response.NotFound(c, "Server not found")
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

		return response.BadGateway(c, "Failed to connect to agent terminal")
	}

	defer func() { _ = agentConn.Close() }()

	termUpgrader := websocket.Upgrader{
		CheckOrigin:  h.checkOrigin,
		Subprotocols: []string{"Bearer"},
	}

	clientConn, err := termUpgrader.Upgrade(c.Response(), c.Request(), nil)
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
				forward, ok := h.prepareTerminalMessage(userID, serverID, stackName, message, &sessionStackName, clientType, clientConn, &operationLogID, sessionStartTime)
				if !ok {
					continue
				}
				message = forward
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

func (h *Handler) prepareTerminalMessage(userID int, serverID int, urlStack string, message []byte, sessionStackName *string, clientType string, clientConn *websocket.Conn, operationLogID **uint, sessionStartTime time.Time) ([]byte, bool) {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {

		h.sendTerminalError(clientConn, "Invalid message format", clientType)
		return nil, false
	}

	switch baseMsg.Type {
	case "terminal_start":
		var startMsg TerminalStartMessage
		if err := json.Unmarshal(message, &startMsg); err != nil {

			h.sendTerminalError(clientConn, "Invalid terminal_start message format", clientType)
			return nil, false
		}

		if startMsg.StackName != "" && startMsg.StackName != urlStack {

			h.sendTerminalError(clientConn, "stack_name must match the authorised stack", clientType)
			return nil, false
		}

		var raw map[string]any
		if err := json.Unmarshal(message, &raw); err != nil {

			h.sendTerminalError(clientConn, "Invalid terminal_start message format", clientType)
			return nil, false
		}
		raw["stack_name"] = urlStack
		forward, err := json.Marshal(raw)
		if err != nil {

			h.sendTerminalError(clientConn, "Invalid terminal_start message format", clientType)
			return nil, false
		}

		*sessionStackName = urlStack

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
			urlStack,
			operationID,
			opRequest,
			sessionStartTime,
		)
		if err == nil && log != nil {
			*operationLogID = &log.ID
		}

		return forward, true

	case "terminal_input", "terminal_resize", "terminal_close":
		if *sessionStackName == "" {

			h.sendTerminalError(clientConn, "No active terminal session", clientType)
			return nil, false
		}

		return message, true

	default:

		h.sendTerminalError(clientConn, "Unknown message type", clientType)
		return nil, false
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
