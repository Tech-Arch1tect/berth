package operations

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"brx-starter-kit/models"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/session"
)

type WebSocketHandler struct {
	service  *Service
	upgrader websocket.Upgrader
}

func NewWebSocketHandler(service *Service) *WebSocketHandler {
	return &WebSocketHandler{
		service: service,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}
}

func (h *WebSocketHandler) HandleOperationWebSocket(c echo.Context) error {
	serverIDStr := c.Param("serverId")
	stackName := c.Param("stackName")
	operationIDStr := c.Param("operationId")

	if serverIDStr == "" || stackName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID and stack name are required",
		})
	}

	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	userID, err := h.getUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Authentication required",
		})
	}

	conn, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()

	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	ctx, cancel := context.WithCancel(c.Request().Context())
	defer cancel()

	if operationIDStr != "" {

		return h.streamExistingOperation(ctx, conn, userID, uint(serverID), stackName, operationIDStr)
	} else {

		return h.handleOperationRequests(ctx, conn, userID, uint(serverID), stackName)
	}
}

func (h *WebSocketHandler) streamExistingOperation(ctx context.Context, conn *websocket.Conn, userID uint, serverID uint, stackName string, operationID string) error {

	pipeReader, pipeWriter := streamPipe()

	go func() {
		defer func() { _ = pipeWriter.Close() }()
		if err := h.service.StreamOperationToWriter(ctx, userID, serverID, stackName, operationID, pipeWriter); err != nil {

			errorMsg := WebSocketMessage{
				Type:  WSMessageTypeError,
				Error: err.Error(),
			}
			if jsonData, marshalErr := json.Marshal(errorMsg); marshalErr == nil {
				_ = conn.WriteMessage(websocket.TextMessage, jsonData)
			}
		}
	}()

	return h.relayToWebSocket(ctx, conn, pipeReader)
}

func (h *WebSocketHandler) handleOperationRequests(ctx context.Context, conn *websocket.Conn, userID uint, serverID uint, stackName string) error {

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return err
			}
		default:

			_, messageData, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					return err
				}
				return nil
			}

			var wsMsg WebSocketMessage
			if err := json.Unmarshal(messageData, &wsMsg); err != nil {
				h.sendError(conn, "Invalid message format")
				continue
			}

			if wsMsg.Type == WSMessageTypeOperationRequest {

				go func(data any) {
					if err := h.processOperationRequest(ctx, conn, userID, serverID, stackName, data); err != nil {
						h.sendError(conn, err.Error())
					}
				}(wsMsg.Data)
			}
		}
	}
}

func (h *WebSocketHandler) processOperationRequest(ctx context.Context, conn *websocket.Conn, userID uint, serverID uint, stackName string, data any) error {

	reqBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	var opReq OperationRequest
	if err := json.Unmarshal(reqBytes, &opReq); err != nil {
		return err
	}

	response, err := h.service.StartOperation(ctx, userID, serverID, stackName, opReq)
	if err != nil {
		return err
	}

	pipeReader, pipeWriter := streamPipe()

	go func() {
		defer func() { _ = pipeWriter.Close() }()

		if err := h.service.StreamOperationToWriter(ctx, userID, serverID, stackName, response.OperationID, pipeWriter); err != nil {

			errorMsg := WebSocketMessage{
				Type:  WSMessageTypeError,
				Error: err.Error(),
			}
			if jsonData, marshalErr := json.Marshal(errorMsg); marshalErr == nil {
				_ = conn.WriteMessage(websocket.TextMessage, jsonData)
			}
		}
	}()

	return h.relayToWebSocket(ctx, conn, pipeReader)
}

func (h *WebSocketHandler) relayToWebSocket(ctx context.Context, conn *websocket.Conn, reader *StreamReader) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case line, ok := <-reader.Lines():
			if !ok {
				return nil
			}

			if len(line) > 6 && line[:6] == "data: " {
				jsonData := line[6:]

				if err := conn.WriteMessage(websocket.TextMessage, []byte(jsonData)); err != nil {
					return err
				}
			}
		}
	}
}

func (h *WebSocketHandler) sendError(conn *websocket.Conn, message string) {
	errorMsg := WebSocketMessage{
		Type:  WSMessageTypeError,
		Error: message,
	}
	if data, err := json.Marshal(errorMsg); err == nil {
		_ = conn.WriteMessage(websocket.TextMessage, data)
	}
}

func (h *WebSocketHandler) getUserID(c echo.Context) (uint, error) {

	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser != nil {
		if userModel, ok := currentUser.(models.User); ok {
			return userModel.ID, nil
		}
	}

	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return 0, echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	return userID, nil
}

type StreamReader struct {
	lines chan string
	done  chan struct{}
}

func (sr *StreamReader) Lines() <-chan string {
	return sr.lines
}

func (sr *StreamReader) Close() {
	close(sr.done)
	close(sr.lines)
}

func streamPipe() (*StreamReader, *StreamWriter) {
	lines := make(chan string, 100)
	done := make(chan struct{})

	reader := &StreamReader{lines: lines, done: done}
	writer := &StreamWriter{lines: lines, done: done}

	return reader, writer
}

type StreamWriter struct {
	lines chan string
	done  chan struct{}
}

func (sw *StreamWriter) Write(p []byte) (n int, err error) {
	select {
	case <-sw.done:
		return 0, echo.NewHTTPError(http.StatusInternalServerError, "stream closed")
	default:
	}

	data := string(p)
	lines := strings.SplitSeq(data, "\n")

	for line := range lines {
		if line != "" {
			select {
			case sw.lines <- line:
			case <-sw.done:
				return len(p), nil
			default:

			}
		}
	}

	return len(p), nil
}

func (sw *StreamWriter) Close() error {
	close(sw.done)
	return nil
}
