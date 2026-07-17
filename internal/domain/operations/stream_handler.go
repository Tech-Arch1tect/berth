package operations

import (
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
	streamPollInterval = 150 * time.Millisecond
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

	return h.tailOperationLog(ctx, conn, operationID, operationLog.ID)
}

func (h *StreamHandler) tailOperationLog(ctx context.Context, conn *websocket.Conn, operationID string, operationLogID uint) error {
	pingTicker := time.NewTicker(streamPingInterval)
	defer pingTicker.Stop()

	lastSeq := 0
	for {
		operationLog, err := h.service.auditSvc.FindOperationLogByOperationID(operationID)
		if err != nil {
			_ = conn.Close(websocket.StatusInternalError, "operation lookup failed")
			return nil
		}
		ended := operationLog.EndTime != nil

		messages, err := h.service.auditSvc.GetOperationMessagesSince(operationLogID, lastSeq)
		if err != nil {
			_ = conn.Close(websocket.StatusInternalError, "operation lookup failed")
			return nil
		}
		for _, m := range messages {
			lastSeq = m.SequenceNumber
			if m.MessageType == string(StreamTypeComplete) {
				continue
			}
			if !h.writeFrame(ctx, conn, StreamMessage{
				Type:      m.MessageType,
				Data:      m.MessageData,
				Timestamp: m.Timestamp,
			}) {
				return nil
			}
		}

		if ended {
			if !h.writeFrame(ctx, conn, StreamMessage{
				Type:      string(StreamTypeComplete),
				Timestamp: *operationLog.EndTime,
				Success:   operationLog.Success,
				ExitCode:  operationLog.ExitCode,
			}) {
				return nil
			}
			_ = conn.Close(websocket.StatusNormalClosure, "")
			return nil
		}

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
		case <-time.After(streamPollInterval):
		}
	}
}

func (h *StreamHandler) writeFrame(ctx context.Context, conn *websocket.Conn, frame StreamMessage) bool {
	data, err := json.Marshal(frame)
	if err != nil {
		return false
	}
	writeCtx, writeCancel := context.WithTimeout(ctx, streamWriteTimeout)
	err = conn.Write(writeCtx, websocket.MessageText, data)
	writeCancel()
	return err == nil
}
