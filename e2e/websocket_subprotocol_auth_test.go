package e2e

import (
	"crypto/tls"
	"net/http"
	"strings"
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func wsURLFor(httpsURL, path string) string {
	return strings.Replace(httpsURL, "https://", "wss://", 1) + path
}

func newTLSWSDialer() *websocket.Dialer {
	return &websocket.Dialer{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
}

func loginAndIssueJWT(t *testing.T, app *TestApp, username, password string) string {
	t.Helper()
	resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: username,
		Password: password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, resp.GetJSON(&login))
	require.NotEmpty(t, login.Data.AccessToken)
	return login.Data.AccessToken
}

func issueAPIKeyForAdmin(t *testing.T, sessionClient *e2etesting.HTTPClient, name string) string {
	t.Helper()
	resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{"name": name})
	require.NoError(t, err)
	require.Equal(t, 201, resp.StatusCode)

	var result response.Response[apikey.CreateAPIKeyData]
	require.NoError(t, resp.GetJSON(&result))
	require.NotEmpty(t, result.Data.PlainKey)
	return result.Data.PlainKey
}

func TestWebSocketSubprotocolAuthHappyPath(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wssubproto",
		Email:    "wssubproto@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	jwt := loginAndIssueJWT(t, app, user.Username, user.Password)
	apiKey := issueAPIKeyForAdmin(t, sessionClient, "ws-subproto-key")

	dialer := newTLSWSDialer()

	t.Run("Sec-WebSocket-Protocol Bearer + JWT upgrades and echoes subprotocol", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		dialer := *dialer
		dialer.Subprotocols = []string{"Bearer", jwt}

		conn, resp, err := dialer.Dial(wsURLFor(app.BaseURL, "/ws/api/stack-status/1"), nil)
		require.NoError(t, err, "WS dial should succeed with valid JWT in Sec-WebSocket-Protocol")
		defer conn.Close()

		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
		assert.Equal(t, "Bearer", resp.Header.Get("Sec-WebSocket-Protocol"),
			"server must echo the Bearer subprotocol so the browser accepts the upgrade")
	})

	t.Run("Sec-WebSocket-Protocol Bearer + API key upgrades and echoes subprotocol", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		dialer := *dialer
		dialer.Subprotocols = []string{"Bearer", apiKey}

		conn, resp, err := dialer.Dial(wsURLFor(app.BaseURL, "/ws/api/stack-status/1"), nil)
		require.NoError(t, err, "WS dial should succeed with valid API key in Sec-WebSocket-Protocol")
		defer conn.Close()

		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
		assert.Equal(t, "Bearer", resp.Header.Get("Sec-WebSocket-Protocol"))
	})

	t.Run("Authorization Bearer + JWT regression", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)

		header := http.Header{}
		header.Set("Authorization", "Bearer "+jwt)

		conn, resp, err := dialer.Dial(wsURLFor(app.BaseURL, "/ws/api/stack-status/1"), header)
		require.NoError(t, err, "WS dial with Authorization header still works")
		defer conn.Close()

		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	})

	t.Run("Authorization Bearer + API key regression", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)

		header := http.Header{}
		header.Set("Authorization", "Bearer "+apiKey)

		conn, resp, err := dialer.Dial(wsURLFor(app.BaseURL, "/ws/api/stack-status/1"), header)
		require.NoError(t, err, "WS dial with API key in Authorization header still works")
		defer conn.Close()

		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
	})
}

func TestWebSocketSubprotocolAuthRejections(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wssubprotoreject",
		Email:    "wssubprotoreject@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	jwt := loginAndIssueJWT(t, app, user.Username, user.Password)

	t.Run("both transports set returns 400 ambiguous", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryValidation, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Authorization":          "Bearer " + jwt,
				"Sec-WebSocket-Protocol": "Bearer, " + jwt,
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 400, "bad_request",
			"Ambiguous authentication: set either Authorization or Sec-WebSocket-Protocol, not both")
	})

	t.Run("malformed Sec-WebSocket-Protocol returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Sec-WebSocket-Protocol": "Token, " + jwt,
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid Sec-WebSocket-Protocol format")
	})

	t.Run("Sec-WebSocket-Protocol with no token half returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Sec-WebSocket-Protocol": "Bearer",
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid Sec-WebSocket-Protocol format")
	})

	t.Run("Sec-WebSocket-Protocol with empty token returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Sec-WebSocket-Protocol": "Bearer, ",
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid Sec-WebSocket-Protocol format")
	})

	t.Run("Sec-WebSocket-Protocol with invalid JWT returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Sec-WebSocket-Protocol": "Bearer, not-a-real-token",
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})

	t.Run("Sec-WebSocket-Protocol with three parts returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/stack-status/:server_id", e2etesting.CategoryEdgeCase, e2etesting.ValueLow)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Sec-WebSocket-Protocol": "Bearer, " + jwt + ", extra",
			},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid Sec-WebSocket-Protocol format")
	})
}
