package websocket

import (
	"berth/internal/pkg/agentsign"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"berth/internal/domain/auth"
	"berth/internal/domain/operations"
	"berth/internal/domain/server"
	"berth/internal/pkg/agentpki"
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
	terminalMu    sync.Mutex
	terminals     map[chan struct{}]context.CancelFunc
	stopping      bool
}

func NewHandler(serverService *server.Service, auditService *operations.AuditService, checkOrigin origin.CheckOriginFunc) *Handler {
	return &Handler{
		serverService: serverService,
		auditService:  auditService,
		checkOrigin:   checkOrigin,
		terminals:     make(map[chan struct{}]context.CancelFunc),
	}
}

func (h *Handler) Stop(ctx context.Context) error {
	h.terminalMu.Lock()
	h.stopping = true
	done := make([]chan struct{}, 0, len(h.terminals))
	for finished, cancel := range h.terminals {
		cancel()
		done = append(done, finished)
	}
	h.terminalMu.Unlock()

	for _, finished := range done {
		select {
		case <-finished:
		case <-ctx.Done():
			return fmt.Errorf("stop terminal sessions: %w", ctx.Err())
		}
	}
	return nil
}

const terminalPath = "/ws/terminal"

func (h *Handler) agentStreamSession(target *server.Server, signer *agentsign.Signer, requestNonce string, upgrade *http.Response) (*agentsign.FrameWriter, *agentsign.FrameReader, error) {
	verifier, err := h.serverService.ResponseVerifier(target)
	if err != nil {
		return nil, nil, err
	}
	peer, err := agentsign.VerifyResponse(verifier, signer, requestNonce, upgrade, 0)
	if err != nil {
		return nil, nil, err
	}
	sessionKey, err := signer.SessionKeyFor(peer, requestNonce)
	if err != nil {
		return nil, nil, err
	}
	return agentsign.NewFrameWriter(sessionKey, agentsign.DirectionToAgent),
		agentsign.NewFrameReader(sessionKey, agentsign.DirectionToBerth), nil
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
	h.terminalMu.Lock()
	if h.stopping {
		h.terminalMu.Unlock()
		return response.ServiceUnavailable(c, "Terminal service is shutting down")
	}
	ctx, cancel := context.WithCancel(c.Request().Context())
	done := make(chan struct{})
	h.terminals[done] = cancel
	h.terminalMu.Unlock()
	defer cancel()
	defer func() {
		h.terminalMu.Lock()
		delete(h.terminals, done)
		close(done)
		h.terminalMu.Unlock()
	}()

	server, err := h.serverService.GetServer(uint(serverID))
	if err != nil {

		return response.NotFound(c, "Server not found")
	}

	if !h.checkOrigin(c.Request()) {
		return response.Forbidden(c, "Origin not allowed")
	}

	agentWSURL := fmt.Sprintf("wss://%s:%d/ws/terminal", server.Host, server.Port)

	dialCtx, dialCancel := context.WithTimeout(ctx, 10*time.Second)
	defer dialCancel()

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", server.AccessToken))

	signer, err := h.serverService.ClientSigner()
	if err != nil {
		return response.BadGateway(c, "Failed to connect to agent terminal")
	}
	if err := signer.SignHeaders(agentpki.AgentIdentity(server.ID), "GET", terminalPath, "", nil, headers); err != nil {
		return response.BadGateway(c, "Failed to connect to agent terminal")
	}

	dialOpts := &websocket.DialOptions{HTTPHeader: headers}
	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		dialOpts.HTTPClient = &http.Client{
			Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		}
	}

	agentConn, upgrade, err := websocket.Dial(dialCtx, agentWSURL, dialOpts)
	if err != nil {

		return response.BadGateway(c, "Failed to connect to agent terminal")
	}
	agentFrames, agentUnframe, err := h.agentStreamSession(server, signer, headers.Get(agentsign.HeaderNonce), upgrade)
	if err != nil {
		agentConn.Close(websocket.StatusPolicyViolation, "unverified agent")
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
					if clientErr == nil {
						_ = clientConn.Close(websocket.StatusInternalError, "proxy ended")
					}
					cancel()
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	clientReadDone := make(chan struct{})
	go func() {
		defer close(clientReadDone)
		defer cancel()
		for {
			messageType, message, err := clientConn.Read(ctx)
			if err != nil {
				return
			}

			if messageType != websocket.MessageText {
				h.sendTerminalError(ctx, clientConn, "Terminal messages must use JSON text frames", clientType)
				return
			}
			forward, ok := h.prepareTerminalMessage(ctx, userID, serverID, stackName, message, &sessionStackName, clientType, clientConn, &operationLogID, sessionStartTime)
			if !ok {
				continue
			}
			message = forward

			writeCtx, writeCancel := context.WithTimeout(ctx, terminalWriteWait)
			err = agentFrames.SendTyped(byte(messageType), message, func(frame []byte) error {
				return agentConn.Write(writeCtx, websocket.MessageBinary, frame)
			})
			writeCancel()
			if err != nil {
				return
			}
		}
	}()

	agentReadDone := make(chan struct{})
	var exitCode *int
	go func() {
		defer close(agentReadDone)
		sessionID := ""
		closeSeen := false
		defer cancel()
		closeStatus := websocket.StatusInternalError
		defer func() {
			_ = clientConn.Close(closeStatus, "proxy ended")
		}()
		for {
			_, framed, err := agentConn.Read(ctx)
			if err != nil {
				if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
					closeStatus = websocket.StatusNormalClosure
				}
				return
			}
			kind, message, unwrapErr := agentUnframe.UnwrapTyped(framed)
			if unwrapErr != nil {
				return
			}
			var acknowledgedSession string
			var measuredCode *int
			if websocket.MessageType(kind) == websocket.MessageText {
				var baseMsg BaseMessage
				if json.Unmarshal(message, &baseMsg) != nil {
					return
				}
				if baseMsg.Type == "success" || baseMsg.Type == "terminal_close" {
					fields, valid := terminalResultFields(message)
					if !valid {
						return
					}
					switch baseMsg.Type {
					case "success":
						if sessionID != "" || json.Unmarshal(fields["session_id"], &acknowledgedSession) != nil || acknowledgedSession == "" {
							return
						}
					case "terminal_close":
						var closeSessionID string
						if closeSeen || json.Unmarshal(fields["session_id"], &closeSessionID) != nil ||
							sessionID == "" || closeSessionID != sessionID {
							return
						}
						if rawCode, present := fields["exit_code"]; present && string(rawCode) != "null" {
							var code int
							if json.Unmarshal(rawCode, &code) != nil {
								return
							}
							measuredCode = new(code)
						}
						closeSeen = true
					}
				}
			}
			writeCtx, writeCancel := context.WithTimeout(ctx, terminalWriteWait)
			err = clientConn.Write(writeCtx, websocket.MessageType(kind), message)
			writeCancel()
			if err != nil {
				return
			}
			if acknowledgedSession != "" {
				sessionID = acknowledgedSession
			}
			if measuredCode != nil && exitCode == nil {
				exitCode = measuredCode
			}
		}
	}()

	<-ctx.Done()

	<-clientReadDone
	<-agentReadDone

	if operationLogID != nil {
		_ = h.auditService.LogTerminalEnd(*operationLogID, time.Now(), exitCode)
	}

	return nil
}

func terminalResultFields(message []byte) (map[string]json.RawMessage, bool) {
	decoder := json.NewDecoder(bytes.NewReader(message))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return nil, false
	}
	fields := make(map[string]json.RawMessage)
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, false
		}
		name, ok := token.(string)
		if !ok {
			return nil, false
		}
		if _, duplicate := fields[name]; duplicate ||
			strings.EqualFold(name, "type") && name != "type" ||
			strings.EqualFold(name, "session_id") && name != "session_id" ||
			strings.EqualFold(name, "exit_code") && name != "exit_code" {
			return nil, false
		}
		var value json.RawMessage
		if decoder.Decode(&value) != nil {
			return nil, false
		}
		fields[name] = value
	}
	if token, err = decoder.Token(); err != nil || token != json.Delim('}') {
		return nil, false
	}
	if len(bytes.TrimSpace(message[decoder.InputOffset():])) != 0 {
		return nil, false
	}
	return fields, true
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

		startMsg.StackName = urlStack
		forward, err := json.Marshal(&startMsg)
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
