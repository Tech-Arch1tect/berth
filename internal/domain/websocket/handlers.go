package websocket

import (
	"context"
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

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
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
	terminalWriteWait    = 10 * time.Second
	terminalReadLimit    = 1 << 20
)

func (h *Handler) proxyTerminalConnection(c echo.Context, serverID int, stackName string, clientType string, userID int) error {

	server, err := h.serverService.GetServer(uint(serverID))
	if err != nil {

		return response.NotFound(c, "Server not found")
	}

	if !h.checkOrigin(c.Request()) {
		return response.Forbidden(c, "Origin not allowed")
	}

	agentWSURL := fmt.Sprintf("wss://%s:%d/ws/terminal", server.Host, server.Port)

	dialCtx, dialCancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer dialCancel()

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", server.AccessToken))

	dialOpts := &websocket.DialOptions{HTTPHeader: headers}
	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		dialOpts.HTTPClient = &http.Client{
			Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		}
	}

	agentConn, _, err := websocket.Dial(dialCtx, agentWSURL, dialOpts)
	if err != nil {

		return response.BadGateway(c, "Failed to connect to agent terminal")
	}
	defer agentConn.Close(websocket.StatusInternalError, "proxy ended")
	agentConn.SetReadLimit(terminalReadLimit)

	clientConn, err := websocket.Accept(c.Response(), c.Request(), &websocket.AcceptOptions{
		Subprotocols:       []string{"Bearer"},
		InsecureSkipVerify: true,
	})
	if err != nil {
		return err
	}
	defer clientConn.Close(websocket.StatusInternalError, "proxy ended")
	clientConn.SetReadLimit(terminalReadLimit)

	ctx, cancel := context.WithCancel(c.Request().Context())
	defer cancel()

	sessionStackName := ""
	var operationLogID *uint
	sessionStartTime := time.Now()

	go func() {
		ticker := time.NewTicker(terminalPingInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				pingCtx, pingCancel := context.WithTimeout(ctx, terminalWriteWait)
				clientErr := clientConn.Ping(pingCtx)
				agentErr := agentConn.Ping(pingCtx)
				pingCancel()
				if clientErr != nil || agentErr != nil {
					cancel()
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	go func() {
		defer cancel()
		for {
			messageType, message, err := clientConn.Read(ctx)
			if err != nil {
				return
			}

			if messageType == websocket.MessageText {
				forward, ok := h.prepareTerminalMessage(ctx, userID, serverID, stackName, message, &sessionStackName, clientType, clientConn, &operationLogID, sessionStartTime)
				if !ok {
					continue
				}
				message = forward
			}

			writeCtx, writeCancel := context.WithTimeout(ctx, terminalWriteWait)
			err = agentConn.Write(writeCtx, messageType, message)
			writeCancel()
			if err != nil {
				return
			}
		}
	}()

	go func() {
		defer cancel()
		for {
			messageType, message, err := agentConn.Read(ctx)
			if err != nil {
				return
			}
			writeCtx, writeCancel := context.WithTimeout(ctx, terminalWriteWait)
			err = clientConn.Write(writeCtx, messageType, message)
			writeCancel()
			if err != nil {
				return
			}
		}
	}()

	<-ctx.Done()

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

func (h *Handler) prepareTerminalMessage(ctx context.Context, userID int, serverID int, urlStack string, message []byte, sessionStackName *string, clientType string, clientConn *websocket.Conn, operationLogID **uint, sessionStartTime time.Time) ([]byte, bool) {
	var baseMsg BaseMessage
	if err := json.Unmarshal(message, &baseMsg); err != nil {

		h.sendTerminalError(ctx, clientConn, "Invalid message format", clientType)
		return nil, false
	}

	switch baseMsg.Type {
	case "terminal_start":
		var startMsg TerminalStartMessage
		if err := json.Unmarshal(message, &startMsg); err != nil {

			h.sendTerminalError(ctx, clientConn, "Invalid terminal_start message format", clientType)
			return nil, false
		}

		if startMsg.StackName != "" && startMsg.StackName != urlStack {

			h.sendTerminalError(ctx, clientConn, "stack_name must match the authorised stack", clientType)
			return nil, false
		}

		var raw map[string]any
		if err := json.Unmarshal(message, &raw); err != nil {

			h.sendTerminalError(ctx, clientConn, "Invalid terminal_start message format", clientType)
			return nil, false
		}
		raw["stack_name"] = urlStack
		forward, err := json.Marshal(raw)
		if err != nil {

			h.sendTerminalError(ctx, clientConn, "Invalid terminal_start message format", clientType)
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

			h.sendTerminalError(ctx, clientConn, "No active terminal session", clientType)
			return nil, false
		}

		return message, true

	default:

		h.sendTerminalError(ctx, clientConn, "Unknown message type", clientType)
		return nil, false
	}
}

func (h *Handler) sendTerminalError(ctx context.Context, conn *websocket.Conn, message string, clientType string) {
	errorResponse := map[string]any{
		"type":      "error",
		"error":     message,
		"timestamp": time.Now(),
	}

	writeCtx, writeCancel := context.WithTimeout(ctx, terminalWriteWait)
	defer writeCancel()
	_ = wsjson.Write(writeCtx, conn, errorResponse)
}
