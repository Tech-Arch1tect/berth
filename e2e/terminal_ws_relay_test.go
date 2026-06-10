package e2e

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTerminalWSRelaysBetweenClientAndAgent(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "terminal-relay-admin",
		Email:    "terminal-relay-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	jwt := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "terminal-relay-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	agentSawFrame := make(chan map[string]any, 1)
	mockAgent.RegisterHandler("/ws/terminal", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
		if err != nil {
			return
		}
		defer conn.Close(websocket.StatusNormalClosure, "")

		ctx := r.Context()
		var frame map[string]any
		if err := wsjson.Read(ctx, conn, &frame); err != nil {
			return
		}
		agentSawFrame <- frame

		_ = wsjson.Write(ctx, conn, map[string]any{
			"type":       "terminal_output",
			"session_id": "session-1",
			"output":     "aGVsbG8=",
			"timestamp":  "2026-06-10T00:00:00Z",
		})
		<-ctx.Done()
	})

	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, upgradeResp, err := dialWS(t,
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/terminal"),
		header,
	)
	require.NoError(t, err, "authorised terminal upgrade should succeed")
	defer func() { _ = conn.Close(websocket.StatusNormalClosure, "") }()
	require.Equal(t, http.StatusSwitchingProtocols, upgradeResp.StatusCode)

	startFrame, err := json.Marshal(map[string]any{
		"type":         "terminal_start",
		"stack_name":   "",
		"service_name": "app",
		"cols":         80,
		"rows":         24,
	})
	require.NoError(t, err)
	require.NoError(t, wsWrite(conn, startFrame))

	select {
	case frame := <-agentSawFrame:
		assert.Equal(t, "terminal_start", frame["type"])
		assert.Equal(t, "web-stack", frame["stack_name"],
			"the proxy must force the authorised stack name onto the forwarded frame")
		assert.Equal(t, "app", frame["service_name"])
	case <-time.After(5 * time.Second):
		t.Fatal("the agent never received the forwarded terminal_start frame")
	}

	_, msg, err := wsRead(conn)
	require.NoError(t, err, "expected the agent's terminal_output frame to be relayed back")

	var out struct {
		Type      string `json:"type"`
		SessionID string `json:"session_id"`
		Output    string `json:"output"`
	}
	require.NoError(t, json.Unmarshal(msg, &out))
	assert.Equal(t, "terminal_output", out.Type)
	assert.Equal(t, "session-1", out.SessionID)
	assert.Equal(t, "aGVsbG8=", out.Output)
}

func TestTerminalWSRejectsMismatchedStartStack(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "terminal-mismatch-admin",
		Email:    "terminal-mismatch-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	jwt := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "terminal-mismatch-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterHandler("/ws/terminal", func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
		if err != nil {
			return
		}
		defer conn.Close(websocket.StatusNormalClosure, "")
		<-r.Context().Done()
	})

	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, _, err := dialWS(t,
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/terminal"),
		header,
	)
	require.NoError(t, err)
	defer func() { _ = conn.Close(websocket.StatusNormalClosure, "") }()

	mismatchedStart, err := json.Marshal(map[string]any{
		"type":         "terminal_start",
		"stack_name":   "other-stack",
		"service_name": "app",
	})
	require.NoError(t, err)
	require.NoError(t, wsWrite(conn, mismatchedStart))

	_, msg, err := wsRead(conn)
	require.NoError(t, err, "expected an error frame for the mismatched stack")

	var errFrame struct {
		Type  string `json:"type"`
		Error string `json:"error"`
	}
	require.NoError(t, json.Unmarshal(msg, &errFrame))
	assert.Equal(t, "error", errFrame.Type)
	assert.Contains(t, errFrame.Error, "stack_name must match", "got frame: %s", string(msg))
}
