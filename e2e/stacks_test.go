package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type StackResponse struct {
	Name              string `json:"name"`
	Path              string `json:"path"`
	ComposeFile       string `json:"compose_file"`
	ServerID          uint   `json:"server_id"`
	ServerName        string `json:"server_name"`
	IsHealthy         bool   `json:"is_healthy"`
	TotalContainers   int    `json:"total_containers"`
	RunningContainers int    `json:"running_containers"`
}

type StacksListResponse struct {
	Stacks []StackResponse `json:"stacks"`
}

type PermissionsResponse struct {
	Permissions []string `json:"permissions"`
}

type StackStatsResponse struct {
	StackName  string `json:"stack_name"`
	Containers []struct {
		Name          string  `json:"name"`
		ServiceName   string  `json:"service_name"`
		CPUPercent    float64 `json:"cpu_percent"`
		MemoryUsage   uint64  `json:"memory_usage"`
		MemoryPercent float64 `json:"memory_percent"`
	} `json:"containers"`
}

type ComposePreviewResponse struct {
	Original string `json:"original"`
	Preview  string `json:"preview"`
}

func TestStackEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "stacksjwtuser",
		Email:    "stacksjwtuser@example.com",
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stacksResp StacksListResponse
		require.NoError(t, resp.GetJSON(&stacksResp))
		assert.NotEmpty(t, stacksResp.Stacks)
		assert.Equal(t, "test-stack", stacksResp.Stacks[0].Name)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname returns stack details", func(t *testing.T) {
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp PermissionsResponse
		require.NoError(t, resp.GetJSON(&permsResp))
		assert.NotNil(t, permsResp.Permissions)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/networks returns networks", func(t *testing.T) {
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp StackStatsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
		assert.Equal(t, "test-stack", statsResp.StackName)
	})
}

func TestStackComposeEndpoints(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "stackscomposeuser",
		Email:    "stackscomposeuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-compose")

	mockAgent.RegisterJSONHandler("/api/compose/preview", map[string]interface{}{
		"data": map[string]interface{}{
			"original": "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
			"preview":  "version: '3'\nservices:\n  web:\n    image: nginx:1.25\n",
		},
	})

	mockAgent.RegisterJSONHandler("/api/compose", map[string]string{
		"message": "Compose file updated successfully",
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/compose/preview returns preview", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/compose/preview",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"changes": map[string]interface{}{
					"service_image_updates": []map[string]interface{}{
						{"service_name": "web", "new_tag": "1.25"},
					},
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var previewResp ComposePreviewResponse
		require.NoError(t, resp.GetJSON(&previewResp))
		assert.NotEmpty(t, previewResp.Original)
		assert.NotEmpty(t, previewResp.Preview)
	})

	t.Run("PATCH /api/v1/servers/:serverid/stacks/:stackname/compose updates compose", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "PATCH",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/compose",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"changes": map[string]interface{}{
					"service_image_updates": []map[string]interface{}{
						{"service_name": "web", "new_tag": "1.25"},
					},
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
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
	mockAgent.RegisterJSONHandler("/api/compose", map[string]string{
		"message": "Compose file updated successfully",
	})

	t.Run("GET /api/v1/servers/:id/stacks works with session auth", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("PATCH /api/servers/:serverid/stacks/:stackname/compose works with session auth", func(t *testing.T) {
		resp, err := sessionClient.Patch("/api/servers/"+itoa(testServer.ID)+"/stacks/session-test-stack/compose", map[string]interface{}{
			"changes": map[string]interface{}{
				"service_image_updates": []map[string]interface{}{
					{"service_name": "web", "new_tag": "1.25"},
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestStackEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-noauth")
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{})

	t.Run("GET /api/v1/servers/:id/stacks requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("PATCH /api/v1/servers/:serverid/stacks/:stackname/compose requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Patch("/api/v1/servers/"+itoa(testServer.ID)+"/stacks/test-stack/compose", map[string]interface{}{
			"changes": map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("PATCH /api/servers/:serverid/stacks/:stackname/compose redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Patch("/api/servers/"+itoa(testServer.ID)+"/stacks/test-stack/compose", map[string]interface{}{
			"changes": map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})
}
