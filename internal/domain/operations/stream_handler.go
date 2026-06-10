package operations

import (
	"berth/internal/domain/authz"
	"context"
	"encoding/json"
	"time"

	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/origin"
	"berth/internal/pkg/response"

	"github.com/coder/websocket"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

const (
	streamPingInterval = 30 * time.Second
	streamWriteTimeout = 10 * time.Second
)

type StreamHandler struct {
	service     *Service
	checkOrigin origin.CheckOriginFunc
	logger      *zap.Logger
}

func NewStreamHandler(service *Service, checkOrigin origin.CheckOriginFunc, logger *zap.Logger) *StreamHandler {
	return &StreamHandler{
		service:     service,
		checkOrigin: checkOrigin,
		logger:      logger,
	}
}

func (h *StreamHandler) HandleOperationStream(c echo.Context) error {
	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}
	operationID := c.Param("operationId")
	if operationID == "" {
		return response.BadRequest(c, "operationId is required")
	}

	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	operationLog, err := h.service.auditSvc.FindOperationLogByOperationID(operationID)
	if err != nil || operationLog.ServerID != serverID || operationLog.StackName != stackname {
		return response.NotFound(c, "Operation not found")
	}

	if !h.checkOrigin(c.Request()) {
		return response.Forbidden(c, "Origin not allowed")
	}

	conn, err := websocket.Accept(c.Response(), c.Request(), &websocket.AcceptOptions{
		Subprotocols:       []string{"Bearer"},
		InsecureSkipVerify: true,
	})
	if err != nil {
		return err
	}
	defer conn.Close(websocket.StatusInternalError, "stream ended")

	ctx, cancel := context.WithCancel(c.Request().Context())
	defer cancel()

	go func() {
		typ, _, err := conn.Reader(ctx)
		if err != nil {
			cancel()
			return
		}
		h.logger.Warn("closing operation stream on unexpected client frame",
			zap.String("operation_id", operationID),
			zap.String("frame_type", typ.String()),
		)
		_ = conn.Close(websocket.StatusPolicyViolation, "client frames are not accepted")
		cancel()
	}()

	var auditLogID *uint
	logAllMessages := false
	if operationLog.EndTime == nil {
		auditLogID = &operationLog.ID
		if count, err := h.service.auditSvc.GetOperationMessageCount(operationLog.ID); err == nil && count == 0 {
			logAllMessages = true
		}
	}

	pipeReader, pipeWriter := streamPipe()
	streamFailed := make(chan string, 1)
	streamEnded := make(chan struct{})

	go func() {
		defer close(streamEnded)
		defer func() { _ = pipeWriter.Close() }()
		if err := h.service.StreamOperationToWriter(ctx, p, serverID, stackname, operationID, pipeWriter); err != nil {
			select {
			case streamFailed <- err.Error():
			default:
			}
		}
	}()

	return h.relay(ctx, conn, pipeReader, streamFailed, streamEnded, auditLogID, logAllMessages)
}

func (h *StreamHandler) relay(ctx context.Context, conn *websocket.Conn, reader *StreamReader, streamFailed <-chan string, streamEnded <-chan struct{}, auditLogID *uint, logAllMessages bool) error {
	pingTicker := time.NewTicker(streamPingInterval)
	defer pingTicker.Stop()

	sequenceNumber := 0

	emit := func(line string) (ok bool) {
		if len(line) <= 6 || line[:6] != "data: " {
			return true
		}
		jsonData := line[6:]

		var streamMsg StreamMessage
		if json.Unmarshal([]byte(jsonData), &streamMsg) == nil && auditLogID != nil {
			if logAllMessages {
				sequenceNumber++
				_ = h.service.auditSvc.LogOperationMessage(
					*auditLogID,
					streamMsg.Type,
					streamMsg.Data,
					streamMsg.Timestamp,
					sequenceNumber,
				)
			}

			if streamMsg.Type == string(StreamTypeComplete) {
				success := streamMsg.Success != nil && *streamMsg.Success
				exitCode := 0
				if streamMsg.ExitCode != nil {
					exitCode = *streamMsg.ExitCode
				}
				_ = h.service.auditSvc.LogOperationEnd(*auditLogID, streamMsg.Timestamp, success, exitCode)
			}
		}

		writeCtx, writeCancel := context.WithTimeout(ctx, streamWriteTimeout)
		err := conn.Write(writeCtx, websocket.MessageText, []byte(jsonData))
		writeCancel()
		return err == nil
	}

	finish := func() {
		select {
		case errMsg := <-streamFailed:
			h.writeStreamError(ctx, conn, errMsg)
			_ = conn.Close(websocket.StatusInternalError, "stream failed")
		default:
			_ = conn.Close(websocket.StatusNormalClosure, "")
		}
	}

	for {
		select {
		case <-ctx.Done():
			_ = conn.Close(websocket.StatusGoingAway, "server closing")
			return nil
		case <-pingTicker.C:
			pingCtx, pingCancel := context.WithTimeout(ctx, streamWriteTimeout)
			err := conn.Ping(pingCtx)
			pingCancel()
			if err != nil {
				return nil
			}
		case line := <-reader.Lines():
			if !emit(line) {
				return nil
			}
		case <-streamEnded:
			for {
				select {
				case line := <-reader.Lines():
					if !emit(line) {
						return nil
					}
				default:
					finish()
					return nil
				}
			}
		}
	}
}

func (h *StreamHandler) writeStreamError(ctx context.Context, conn *websocket.Conn, message string) {
	frame := StreamMessage{
		Type:      string(StreamTypeError),
		Data:      message,
		Timestamp: time.Now(),
	}
	data, err := json.Marshal(frame)
	if err != nil {
		return
	}
	writeCtx, writeCancel := context.WithTimeout(ctx, streamWriteTimeout)
	defer writeCancel()
	_ = conn.Write(writeCtx, websocket.MessageText, data)
}
