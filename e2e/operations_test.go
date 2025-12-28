package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type OperationStartResponse struct {
	OperationID string `json:"operationId"`
}

type OperationLogStats struct {
	TotalOperations      int64 `json:"total_operations"`
	IncompleteOperations int64 `json:"incomplete_operations"`
	FailedOperations     int64 `json:"failed_operations"`
	SuccessfulOperations int64 `json:"successful_operations"`
	RecentOperations     int64 `json:"recent_operations"`
}

type PaginatedOperationLogs struct {
	Data       []map[string]interface{} `json:"data"`
	Pagination struct {
		CurrentPage int   `json:"current_page"`
		PageSize    int   `json:"page_size"`
		Total       int64 `json:"total"`
		TotalPages  int   `json:"total_pages"`
		HasNext     bool  `json:"has_next"`
		HasPrev     bool  `json:"has_prev"`
	} `json:"pagination"`
}

type OperationLogDetail struct {
	Log      map[string]interface{}   `json:"log"`
	Messages []map[string]interface{} `json:"messages"`
}

type LogsResponse struct {
	Logs []struct {
		Timestamp string `json:"timestamp"`
		Message   string `json:"message"`
		Source    string `json:"source"`
	} `json:"logs"`
}

func TestOperationsEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "opsjwtuser",
		Email:    "opsjwtuser@example.com",
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logs PaginatedOperationLogs
		require.NoError(t, resp.GetJSON(&logs))
		assert.GreaterOrEqual(t, logs.Pagination.CurrentPage, 1)
	})

	t.Run("GET /api/v1/operation-logs/stats returns user stats", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/operation-logs/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stats OperationLogStats
		require.NoError(t, resp.GetJSON(&stats))
		assert.GreaterOrEqual(t, stats.TotalOperations, int64(0))
	})

	t.Run("GET /api/v1/running-operations returns running operations", func(t *testing.T) {
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs?tail=50",
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

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs returns container logs", func(t *testing.T) {
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

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/operation-logs returns all operation logs", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/operation-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logs PaginatedOperationLogs
		require.NoError(t, resp.GetJSON(&logs))
		assert.GreaterOrEqual(t, logs.Pagination.CurrentPage, 1)
	})

	t.Run("GET /api/v1/admin/operation-logs/stats returns global stats", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/operation-logs/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stats OperationLogStats
		require.NoError(t, resp.GetJSON(&stats))
		assert.GreaterOrEqual(t, stats.TotalOperations, int64(0))
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

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/operation-logs/:id returns 404 for non-existent log", func(t *testing.T) {
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
		resp, err := app.HTTPClient.Get("/api/v1/operation-logs")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
