package e2e

import (
	"testing"

	"berth/handlers"
	"berth/internal/stack"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestStackEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "stacksjwtuser",
		Email:    "stacksjwtuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-stacks")

	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{
		{
			"name":               "test-stack",
			"path":               "/opt/compose/test-stack",
			"compose_file":       "docker-compose.yml",
			"is_healthy":         true,
			"total_containers":   2,
			"running_containers": 2,
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack", map[string]interface{}{
		"name":         "test-stack",
		"path":         "/opt/compose/test-stack",
		"compose_file": "docker-compose.yml",
		"services": []map[string]interface{}{
			{
				"name":  "web",
				"image": "nginx:latest",
				"containers": []map[string]interface{}{
					{"name": "test-stack-web-1", "state": "running"},
				},
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/networks", []map[string]interface{}{
		{"name": "test-stack_default", "driver": "bridge", "exists": true},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/volumes", []map[string]interface{}{
		{"name": "test-stack_data", "driver": "local", "exists": true},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/environment", map[string]interface{}{
		"web": []map[string]interface{}{
			{
				"service_name": "web",
				"variables": []map[string]interface{}{
					{"key": "NODE_ENV", "value": "production", "is_sensitive": false},
				},
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/images", []map[string]interface{}{
		{
			"container_name": "test-stack-web-1",
			"image_id":       "sha256:abc123",
			"image_name":     "nginx:latest",
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/stats", map[string]interface{}{
		"stack_name": "test-stack",
		"containers": []map[string]interface{}{
			{
				"name":           "test-stack-web-1",
				"service_name":   "web",
				"cpu_percent":    2.5,
				"memory_usage":   52428800,
				"memory_percent": 4.88,
			},
		},
	})

	t.Run("GET /api/v1/servers/:id/stacks returns stacks list", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stacksResp stack.ListStacksResponse
		require.NoError(t, resp.GetJSON(&stacksResp))
		assert.True(t, stacksResp.Success)
		assert.NotEmpty(t, stacksResp.Data.Stacks)
		assert.Equal(t, "test-stack", stacksResp.Data.Stacks[0].Name)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname returns stack details", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/permissions returns permissions", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp stack.StackPermissionsResponse
		require.NoError(t, resp.GetJSON(&permsResp))
		assert.True(t, permsResp.Success)
		assert.NotNil(t, permsResp.Data.Permissions)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/networks returns networks", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/networks", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/networks",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/volumes returns volumes", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/volumes", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/volumes",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/environment returns environment", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/environment", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/environment",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/images returns images", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/images", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/images",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/stats returns stats", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/stats", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp stack.StackStatsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
		assert.True(t, statsResp.Success)
		assert.Equal(t, "test-stack", statsResp.Data.StackName)
	})
}

func TestStackEndpointsSessionAuth(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "stackssessionuser",
		Email:    "stackssessionuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-stacks-session")

	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{
		{"name": "session-test-stack", "is_healthy": true},
	})

	t.Run("GET /api/v1/servers/:id/stacks works with session auth", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestStackEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-noauth")
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{})

	t.Run("GET /api/v1/servers/:id/stacks requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
