package websocket

import (
	"context"
	"time"

	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/origin"
	"berth/internal/pkg/response"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

const (
	eventsPingInterval = 30 * time.Second
	eventsWriteTimeout = 10 * time.Second
)

type EventsHandler struct {
	registry    *StackEventRegistry
	checkOrigin origin.CheckOriginFunc
	logger      *zap.Logger
}

func NewEventsHandler(registry *StackEventRegistry, checkOrigin origin.CheckOriginFunc, logger *zap.Logger) *EventsHandler {
	return &EventsHandler{
		registry:    registry,
		checkOrigin: checkOrigin,
		logger:      logger,
	}
}

func (h *EventsHandler) HandleStackEvents(c echo.Context) error {
	serverID, stackName, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
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

	sub, cancel := h.registry.Subscribe(StackKey{ServerID: serverID, StackName: stackName})
	defer cancel()

	ctx := c.Request().Context()

	go func() {
		for {
			typ, _, err := conn.Reader(ctx)
			if err != nil {
				sub.Stop()
				return
			}
			h.logger.Warn("closing stack events connection on unexpected client frame",
				zap.Uint("server_id", serverID),
				zap.String("stack_name", stackName),
				zap.String("frame_type", typ.String()),
			)
			_ = conn.Close(websocket.StatusPolicyViolation, "client frames are not accepted")
			sub.Stop()
			return
		}
	}()

	pingTicker := time.NewTicker(eventsPingInterval)
	defer pingTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			_ = conn.Close(websocket.StatusGoingAway, "server closing")
			return nil
		case <-sub.Done():
			_ = conn.Close(websocket.StatusNormalClosure, "")
			return nil
		case <-pingTicker.C:
			pingCtx, pingCancel := context.WithTimeout(ctx, eventsWriteTimeout)
			err := conn.Ping(pingCtx)
			pingCancel()
			if err != nil {
				return nil
			}
		case event := <-sub.Events():
			writeCtx, writeCancel := context.WithTimeout(ctx, eventsWriteTimeout)
			err := wsjson.Write(writeCtx, conn, event)
			writeCancel()
			if err != nil {
				return nil
			}
		}
	}
}
