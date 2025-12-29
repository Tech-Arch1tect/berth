package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestWebSocketStackStatusNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /ws/ui/stack-status/:server_id requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/ui/stack-status/1")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/stack-status/:server_id requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/api/stack-status/1")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketTerminalNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /ws/ui/servers/:serverid/terminal requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/ui/servers/1/terminal")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/terminal requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/terminal")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketOperationsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /ws/ui/servers/:serverid/stacks/:stackname/operations requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/ui/servers/1/stacks/test-stack/operations")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/stacks/test-stack/operations")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/ui/servers/:serverid/stacks/:stackname/operations/:operationId requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/ui/servers/1/stacks/test-stack/operations/op-123")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations/:operationId requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/ws/api/servers/1/stacks/test-stack/operations/op-123")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketStackStatusJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsuser",
		Email:    "wsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /ws/api/stack-status/:server_id with valid token", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})
}

func TestWebSocketTerminalJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsterminaluser",
		Email:    "wsterminaluser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /ws/api/servers/:serverid/terminal with valid token attempts connection", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/terminal",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})
}

func TestWebSocketOperationsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "wsopsuser",
		Email:    "wsopsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations with valid token attempts connection", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/operations",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		assert.NotEqual(t, 401, resp.StatusCode, "should not return 401 with valid token")
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations/:operationId with valid token attempts connection", func(t *testing.T) {
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
	app := SetupTestApp(t)

	t.Run("GET /ws/api/stack-status/:server_id with invalid token returns 401", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/terminal with invalid token returns 401", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/terminal",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/servers/:serverid/stacks/:stackname/operations with invalid token returns 401", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/servers/1/stacks/test-stack/operations",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestWebSocketMalformedAuthorization(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /ws/api/stack-status/:server_id with malformed auth returns 401", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Authorization": "NotBearer token",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /ws/api/stack-status/:server_id with empty bearer returns 401", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/ws/api/stack-status/1",
			Headers: map[string]string{
				"Authorization": "Bearer ",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
