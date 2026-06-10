package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebSocketStackEventsNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/events requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/stacks/test-stack/events")
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authorization header required")
	})
}

func TestWebSocketTerminalNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/terminal requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/terminal", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/stacks/test-stack/terminal")
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authorization header required")
	})
}

func TestWebSocketOperationStreamNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations/:operationId requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/operations/:operationId", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/stacks/test-stack/operations/op-123")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketEnvelopeShape(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("invalid bearer token returns envelope with unauthorized code", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{"Authorization": "Bearer invalid-token"},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})

	t.Run("malformed authorization header returns envelope", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{"Authorization": "NotBearer token"},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid authorization header format")
	})

	t.Run("bare Bearer prefix returns envelope", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{"Authorization": "Bearer"},
		})
		require.NoError(t, err)
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Invalid authorization header format")
	})

}

func TestWebSocketStackEventsJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsuser",
		Email:    "wsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/events with valid token", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})
}

func TestWebSocketTerminalJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsterminaluser",
		Email:    "wsterminaluser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/terminal with valid token attempts connection", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/terminal", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/terminal",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})
}

func TestWebSocketOperationStreamJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsopsuser",
		Email:    "wsopsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations/:operationId with valid token attempts connection", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/operations/:operationId", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/operations/op-123",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})
}

func TestWebSocketInvalidToken(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/events with invalid token returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/terminal with invalid token returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/terminal", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/terminal",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations/:operationId with invalid token returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/operations/:operationId", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/operations/op-123",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketMalformedAuthorization(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/events with malformed auth returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{
				"Authorization": "NotBearer token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/events with empty bearer returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/events",
			Headers: map[string]string{
				"Authorization": "Bearer ",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
