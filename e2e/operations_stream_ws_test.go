package e2e

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/pkg/response"

	"github.com/coder/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func startStreamTestOperation(t *testing.T, app *TestApp, agent *MockAgent, jwt string, serverID uint, stackName, operationID string) {
	t.Helper()

	agent.RegisterJSONHandler("/api/stacks/"+stackName+"/operations", map[string]any{
		"operationId": operationID,
	})

	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: http.MethodPost,
		Path:   "/api/v1/servers/" + Itoa(serverID) + "/stacks/" + stackName + "/operations",
		Body:   map[string]any{"command": "restart", "options": []string{}, "services": []string{}},
		Headers: map[string]string{
			"Authorization": "Bearer " + jwt,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode, "seeding operation: %s", resp.GetString())

	var started response.Response[struct {
		OperationID string `json:"operationId"`
	}]
	require.NoError(t, resp.GetJSON(&started))
	require.Equal(t, operationID, started.Data.OperationID)
}

func TestOperationStreamWSDeliversOperationOutput(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "stream-deliver-admin",
		Email:    "stream-deliver-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	jwt := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "stream-deliver-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	const opID = "stream-deliver-op"

	mockAgent.RegisterHandler("/api/operations/"+opID+"/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		now := time.Now().UTC().Format(time.RFC3339Nano)
		fmt.Fprintf(w, "data: {\"type\":\"stdout\",\"data\":\"restarting web-stack\",\"timestamp\":\"%s\"}\n\n", now)
		fmt.Fprintf(w, "data: {\"type\":\"complete\",\"success\":true,\"exitCode\":0,\"timestamp\":\"%s\"}\n\n", now)
	})

	startStreamTestOperation(t, app, mockAgent, jwt, testServer.ID, "web-stack", opID)

	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, upgradeResp, err := dialWS(t,
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/operations/"+opID),
		header,
	)
	require.NoError(t, err, "authorised stream upgrade should succeed")
	defer func() { _ = conn.Close(websocket.StatusNormalClosure, "") }()
	require.Equal(t, http.StatusSwitchingProtocols, upgradeResp.StatusCode)

	type frame struct {
		Type     string `json:"type"`
		Data     string `json:"data"`
		Success  *bool  `json:"success"`
		ExitCode *int   `json:"exitCode"`
	}

	readFrame := func() frame {
		t.Helper()
		_, msg, err := wsRead(conn)
		require.NoError(t, err, "expected a stream frame")
		var f frame
		require.NoError(t, json.Unmarshal(msg, &f))
		return f
	}

	first := readFrame()
	assert.Equal(t, "stdout", first.Type)
	assert.Equal(t, "restarting web-stack", first.Data)

	second := readFrame()
	assert.Equal(t, "complete", second.Type)
	require.NotNil(t, second.Success)
	assert.True(t, *second.Success)

	_, _, err = wsRead(conn)
	require.Error(t, err, "expected a close frame after the stream ended")
	assert.Equal(t, websocket.StatusNormalClosure, websocket.CloseStatus(err),
		"expected a normal closure; got %v", err)
}

func TestOperationStreamWSClosesOnClientFrame(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "stream-frame-admin",
		Email:    "stream-frame-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	jwt := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "stream-frame-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	const opID = "stream-frame-op"

	mockAgent.RegisterHandler("/api/operations/"+opID+"/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "data: {\"type\":\"stdout\",\"data\":\"running\",\"timestamp\":\"2026-06-09T12:00:00Z\"}\n\n")
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		<-r.Context().Done()
	})

	startStreamTestOperation(t, app, mockAgent, jwt, testServer.ID, "web-stack", opID)

	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, _, err := dialWS(t,
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/operations/"+opID),
		header,
	)
	require.NoError(t, err)
	defer func() { _ = conn.Close(websocket.StatusNormalClosure, "") }()

	_, _, err = wsRead(conn)
	require.NoError(t, err)

	require.NoError(t, wsWrite(conn, []byte(`{"type":"operation_request"}`)))

	_, _, err = wsRead(conn)
	require.Error(t, err, "expected the server to close the connection")
	assert.Equal(t, websocket.StatusPolicyViolation, websocket.CloseStatus(err),
		"server must close with a policy violation on an unexpected client frame; got %v", err)
}
