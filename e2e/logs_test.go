package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestLogsEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "logsuser",
		Email:    "logsuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-logs")

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/logs", map[string]interface{}{
		"logs": []map[string]interface{}{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "Stack log message 1",
				"source":    "web-1",
				"level":     "info",
			},
			{
				"timestamp": "2024-01-15T10:30:01Z",
				"message":   "Stack log message 2",
				"source":    "db-1",
				"level":     "warn",
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/containers/web-1/logs", map[string]interface{}{
		"logs": []map[string]interface{}{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "Container log message",
				"source":    "web-1",
				"level":     "info",
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/nonexistent-stack/logs", map[string]interface{}{
		"error": "stack not found",
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs returns stack logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logs LogsResponse
		require.NoError(t, resp.GetJSON(&logs))
		assert.NotEmpty(t, logs.Logs)
		assert.Equal(t, 2, len(logs.Logs))
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs with tail parameter", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryHappyPath, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs?tail=50",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs with since parameter", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryHappyPath, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs?since=1h",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs with timestamps=false", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryHappyPath, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs?timestamps=false",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs returns container logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/containers/web-1/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logs LogsResponse
		require.NoError(t, resp.GetJSON(&logs))
		assert.NotEmpty(t, logs.Logs)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs with parameters", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", e2etesting.CategoryHappyPath, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/containers/web-1/logs?tail=100&since=5m&timestamps=true",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestLogsEndpointsErrorCases(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "logserroruser",
		Email:    "logserroruser@example.com",
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

	_, testServer := app.CreateTestServerWithAgent(t, "test-server-logs-error")

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs with invalid server returns 404", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/99999/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs with invalid server returns 404", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/99999/stacks/test-stack/containers/web-1/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs without container name returns 400", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", e2etesting.CategoryEdgeCase, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/containers//logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		assert.True(t, resp.StatusCode == 400 || resp.StatusCode == 404)
	})
}

func TestLogsEndpointsRBAC(t *testing.T) {
	app := SetupTestApp(t)

	adminUser := &e2etesting.TestUser{
		Username: "logsrbacadmin",
		Email:    "logsrbacadmin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, adminUser)

	adminLoginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: adminUser.Username,
		Password: adminUser.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, adminLoginResp.StatusCode)

	var adminLogin LoginResponse
	require.NoError(t, adminLoginResp.GetJSON(&adminLogin))
	adminToken := adminLogin.AccessToken

	regularUser := &e2etesting.TestUser{
		Username: "logsregularuser",
		Email:    "logsregularuser@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regularUser)

	regularLoginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: regularUser.Username,
		Password: regularUser.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, regularLoginResp.StatusCode)

	var regularLogin LoginResponse
	require.NoError(t, regularLoginResp.GetJSON(&regularLogin))
	regularToken := regularLogin.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-logs-rbac")

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/logs", map[string]interface{}{
		"logs": []map[string]interface{}{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "Test log",
				"source":    "web-1",
			},
		},
	})

	t.Run("Admin user can access stack logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + adminToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("Regular user without logs.read permission cannot access stack logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + regularToken,
			},
		})
		require.NoError(t, err)

		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("Regular user without logs.read permission cannot access container logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/containers/web-1/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + regularToken,
			},
		})
		require.NoError(t, err)

		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("Unauthenticated request returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
