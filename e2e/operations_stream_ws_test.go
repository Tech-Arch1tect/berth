package e2e

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/pkg/response"

	"github.com/gorilla/websocket"
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
	startStreamTestOperation(t, app, mockAgent, jwt, testServer.ID, "web-stack", opID)

	mockAgent.RegisterHandler("/api/operations/"+opID+"/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "data: {\"type\":\"stdout\",\"data\":\"restarting web-stack\",\"timestamp\":\"2026-06-09T12:00:00Z\"}\n\n")
		fmt.Fprint(w, "data: {\"type\":\"complete\",\"success\":true,\"exitCode\":0,\"timestamp\":\"2026-06-09T12:00:01Z\"}\n\n")
	})

	dialer := newTLSWSDialer()
	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, upgradeResp, err := dialer.Dial(
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/operations/"+opID),
		header,
	)
	require.NoError(t, err, "authorised stream upgrade should succeed")
	defer func() { _ = conn.Close() }()
	require.Equal(t, http.StatusSwitchingProtocols, upgradeResp.StatusCode)

	type frame struct {
		Type     string `json:"type"`
		Data     string `json:"data"`
		Success  *bool  `json:"success"`
		ExitCode *int   `json:"exitCode"`
	}

	readFrame := func() frame {
		t.Helper()
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, msg, err := conn.ReadMessage()
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

	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = conn.ReadMessage()
	var closeErr *websocket.CloseError
	require.ErrorAs(t, err, &closeErr, "expected a close frame after the stream ended")
	assert.Equal(t, websocket.CloseNormalClosure, closeErr.Code)
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
	startStreamTestOperation(t, app, mockAgent, jwt, testServer.ID, "web-stack", opID)

	mockAgent.RegisterHandler("/api/operations/"+opID+"/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "data: {\"type\":\"stdout\",\"data\":\"running\",\"timestamp\":\"2026-06-09T12:00:00Z\"}\n\n")
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		<-r.Context().Done()
	})

	dialer := newTLSWSDialer()
	header := http.Header{}
	header.Set("Authorization", "Bearer "+jwt)

	conn, _, err := dialer.Dial(
		wsURLFor(app.BaseURL, "/ws/api/servers/"+Itoa(testServer.ID)+"/stacks/web-stack/operations/"+opID),
		header,
	)
	require.NoError(t, err)
	defer func() { _ = conn.Close() }()

	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = conn.ReadMessage()
	require.NoError(t, err)

	require.NoError(t, conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"operation_request"}`)))

	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = conn.ReadMessage()
	var closeErr *websocket.CloseError
	require.ErrorAs(t, err, &closeErr, "expected the server to close the connection")
	assert.Equal(t, websocket.ClosePolicyViolation, closeErr.Code,
		"server must close with a policy violation on an unexpected client frame")
}
