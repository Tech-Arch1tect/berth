package websocket

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"berth/internal/domain/server"
	"berth/internal/platform/db"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func fakeAgent(t *testing.T, accessToken string, messages []map[string]any) *httptest.Server {
	t.Helper()

	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/ws/agent/status" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+accessToken {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
		if err != nil {
			return
		}
		defer conn.Close(websocket.StatusNormalClosure, "")

		ctx := r.Context()
		for _, msg := range messages {
			if err := wsjson.Write(ctx, conn, msg); err != nil {
				return
			}
		}
		<-ctx.Done()
	}))
	t.Cleanup(srv.Close)
	return srv
}

func agentServerModel(t *testing.T, srv *httptest.Server, id uint, accessToken string) *server.Server {
	t.Helper()
	u, err := url.Parse(srv.URL)
	require.NoError(t, err)
	port, err := strconv.Atoi(u.Port())
	require.NoError(t, err)

	skip := true
	return &server.Server{
		BaseModel:           db.BaseModel{ID: id},
		Name:                "fake-agent",
		Host:                u.Hostname(),
		Port:                port,
		SkipSSLVerification: &skip,
		AccessToken:         accessToken,
	}
}

func TestAgentClientPublishesStatusEventsToRegistry(t *testing.T) {
	agent := fakeAgent(t, "agent-token", []map[string]any{
		{
			"type":       "stack_status",
			"timestamp":  "2026-06-10T00:00:00Z",
			"stack_name": "web",
			"status":     "running",
			"services":   2,
			"running":    2,
			"stopped":    0,
		},
		{
			"type":           "container_status",
			"timestamp":      "2026-06-10T00:00:01Z",
			"stack_name":     "web",
			"service_name":   "app",
			"container_name": "web-app-1",
			"container_id":   "abc123",
			"status":         "running",
			"image":          "nginx:latest",
		},
		{

			"type":       "operation_progress",
			"timestamp":  "2026-06-10T00:00:02Z",
			"stack_name": "web",
			"operation":  "up",
			"raw_output": "x",
			"completed":  false,
		},
	})

	registry := NewStackEventRegistry(zap.NewNop())
	sub, cancel := registry.Subscribe(StackKey{ServerID: 7, StackName: "web"})
	defer cancel()

	mgr := NewAgentManager(registry, zap.NewNop())
	require.NoError(t, mgr.ConnectToAgent(agentServerModel(t, agent, 7, "agent-token")))
	defer mgr.DisconnectAgent(7)

	first := receiveEvent(t, sub)
	require.IsType(t, StackStatusEvent{}, first)
	stackEvent := first.(StackStatusEvent)
	assert.Equal(t, 7, stackEvent.ServerID, "the ingest must stamp the server ID")
	assert.Equal(t, "web", stackEvent.StackName)
	assert.Equal(t, "running", stackEvent.Status)
	assert.Equal(t, 2, stackEvent.Running)

	second := receiveEvent(t, sub)
	require.IsType(t, ContainerStatusEvent{}, second)
	containerEvent := second.(ContainerStatusEvent)
	assert.Equal(t, 7, containerEvent.ServerID)
	assert.Equal(t, "web-app-1", containerEvent.ContainerName)

	assertNoEvent(t, sub)
}

func TestAgentClientReportsConnectionStatus(t *testing.T) {
	agent := fakeAgent(t, "agent-token", nil)

	registry := NewStackEventRegistry(zap.NewNop())
	mgr := NewAgentManager(registry, zap.NewNop())
	require.NoError(t, mgr.ConnectToAgent(agentServerModel(t, agent, 3, "agent-token")))
	defer mgr.DisconnectAgent(3)

	require.Eventually(t, func() bool {
		return mgr.GetConnectionStatus(3)
	}, 5*time.Second, 50*time.Millisecond, "agent connection should be reported once established")

	assert.False(t, mgr.GetConnectionStatus(99), "unknown server must report disconnected")
}
