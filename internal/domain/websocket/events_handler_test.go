package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func newEventsTestServer(t *testing.T, registry *StackEventRegistry, checkOrigin func(r *http.Request) bool) *httptest.Server {
	t.Helper()
	e := echo.New()
	h := NewEventsHandler(registry, checkOrigin, zap.NewNop())
	e.GET("/servers/:serverid/stacks/:stackname/events", h.HandleStackEvents)
	srv := httptest.NewServer(e)
	t.Cleanup(srv.Close)
	return srv
}

func dialEvents(t *testing.T, srv *httptest.Server, path string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + path
	conn, resp, err := websocket.Dial(ctx, wsURL, nil)
	require.NoError(t, err, "WebSocket dial to %s failed", path)
	require.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	t.Cleanup(func() { _ = conn.Close(websocket.StatusNormalClosure, "") })
	return conn
}

func readEventJSON(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	typ, data, err := conn.Read(ctx)
	require.NoError(t, err)
	require.Equal(t, websocket.MessageText, typ)

	var decoded map[string]any
	require.NoError(t, json.Unmarshal(data, &decoded))
	return decoded
}

func allowAllOrigins(*http.Request) bool { return true }

func TestStackEventsStreamDeliversOnlyTheURLStack(t *testing.T) {
	registry := NewStackEventRegistry(zap.NewNop())
	srv := newEventsTestServer(t, registry, allowAllOrigins)

	connAlpha := dialEvents(t, srv, "/servers/1/stacks/alpha/events")
	connBeta := dialEvents(t, srv, "/servers/1/stacks/beta/events")

	require.Eventually(t, func() bool {
		registry.mu.RLock()
		defer registry.mu.RUnlock()
		return len(registry.conns) == 2
	}, 2*time.Second, 10*time.Millisecond)

	registry.PublishStackStatus(StackStatusEvent{
		BaseMessage: BaseMessage{Type: MessageTypeStackStatus, Timestamp: "2026-06-09T00:00:00Z"},
		ServerID:    1,
		StackName:   "alpha",
		Status:      "running",
		Services:    2,
		Running:     2,
	})
	registry.PublishContainerStatus(ContainerStatusEvent{
		BaseMessage:   BaseMessage{Type: MessageTypeContainerStatus, Timestamp: "2026-06-09T00:00:01Z"},
		ServerID:      1,
		StackName:     "alpha",
		ServiceName:   "app",
		ContainerName: "alpha-app-1",
		ContainerID:   "abc123",
		Status:        "running",
		Image:         "nginx:latest",
	})

	first := readEventJSON(t, connAlpha)
	assert.Equal(t, "stack_status", first["type"])
	assert.Equal(t, "alpha", first["stack_name"])
	assert.Equal(t, float64(1), first["server_id"])
	assert.Equal(t, "running", first["status"])

	second := readEventJSON(t, connAlpha)
	assert.Equal(t, "container_status", second["type"])
	assert.Equal(t, "alpha", second["stack_name"])
	assert.Equal(t, "alpha-app-1", second["container_name"])

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	_, _, err := connBeta.Read(ctx)
	require.Error(t, err, "the beta stack connection must not receive alpha's events")
	assert.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestStackEventsStreamClosesOnClientFrame(t *testing.T) {
	registry := NewStackEventRegistry(zap.NewNop())
	srv := newEventsTestServer(t, registry, allowAllOrigins)

	conn := dialEvents(t, srv, "/servers/1/stacks/alpha/events")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	require.NoError(t, conn.Write(ctx, websocket.MessageText, []byte(`{"type":"subscribe"}`)))

	_, _, err := conn.Read(ctx)
	require.Error(t, err)
	assert.Equal(t, websocket.StatusPolicyViolation, websocket.CloseStatus(err),
		"server must close with a policy violation on an unexpected client frame; got %v", err)
}

func TestStackEventsStreamRejectsDisallowedOrigin(t *testing.T) {
	registry := NewStackEventRegistry(zap.NewNop())
	srv := newEventsTestServer(t, registry, func(*http.Request) bool { return false })

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/servers/1/stacks/alpha/events", nil)
	require.NoError(t, err)
	resp, err := srv.Client().Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode,
		"a request failing the origin check must be rejected before the upgrade")
}

func TestStackEventsStreamRejectsInvalidServerID(t *testing.T) {
	registry := NewStackEventRegistry(zap.NewNop())
	srv := newEventsTestServer(t, registry, allowAllOrigins)

	resp, err := srv.Client().Get(srv.URL + "/servers/not-a-number/stacks/alpha/events")
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
