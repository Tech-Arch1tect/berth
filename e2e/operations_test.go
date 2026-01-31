package e2e

import (
	"testing"

	"berth/handlers"
	"berth/internal/dto"
	"berth/internal/logs"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type OperationStartResponse struct {
	OperationID string `json:"operationId"`
}

func TestOperationsEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "opsjwtuser",
		Email:    "opsjwtuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-ops")

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/operations", map[string]interface{}{
		"operationId": "test-operation-123",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/logs", map[string]interface{}{
		"logs": []map[string]interface{}{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "Server started",
				"source":    "web",
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/containers/web-1/logs", map[string]interface{}{
		"logs": []map[string]interface{}{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "Container log message",
				"source":    "web-1",
			},
		},
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/operations starts operation", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/operations",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"command": "up",
				"options": []string{"-d"},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var opResp OperationStartResponse
		require.NoError(t, resp.GetJSON(&opResp))
		assert.NotEmpty(t, opResp.OperationID)
	})

	t.Run("GET /api/v1/operation-logs returns user operation logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/operation-logs", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp dto.PaginatedOperationLogsResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		assert.True(t, logsResp.Success)
		assert.GreaterOrEqual(t, logsResp.Data.Pagination.CurrentPage, 1)
	})

	t.Run("GET /api/v1/operation-logs/stats returns user stats", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/operation-logs/stats", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp dto.OperationLogStatsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
		assert.True(t, statsResp.Success)
		assert.GreaterOrEqual(t, statsResp.Data.TotalOperations, int64(0))
	})

	t.Run("GET /api/v1/running-operations returns running operations", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/running-operations", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/running-operations",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs returns stack logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs?tail=50",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp logs.LogsResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		assert.True(t, logsResp.Success)
		assert.NotEmpty(t, logsResp.Data.Logs)
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
	})
}

func TestAdminOperationLogsEndpoints(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "adminopsuser",
		Email:    "adminopsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("GET /api/v1/admin/operation-logs returns all operation logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/operation-logs", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/operation-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp dto.PaginatedOperationLogsResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		assert.True(t, logsResp.Success)
		assert.GreaterOrEqual(t, logsResp.Data.Pagination.CurrentPage, 1)
	})

	t.Run("GET /api/v1/admin/operation-logs/stats returns global stats", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/operation-logs/stats", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/operation-logs/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp dto.OperationLogStatsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
		assert.True(t, statsResp.Success)
		assert.GreaterOrEqual(t, statsResp.Data.TotalOperations, int64(0))
	})
}

func TestOperationLogsDetailEndpoints(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "opsdetailuser",
		Email:    "opsdetailuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("GET /api/v1/operation-logs/:id returns 404 for non-existent log", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/operation-logs/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs/99999",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("GET /api/v1/operation-logs/by-operation-id/:operationId returns 404 for non-existent operation", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/operation-logs/by-operation-id/:operationId", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs/by-operation-id/non-existent-uuid",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestOperationsEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-ops-noauth")
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/operations", map[string]interface{}{})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/operations requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/operations",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: map[string]interface{}{
				"command": "up",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/operation-logs requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/operation-logs", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/operation-logs")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
