package e2e

import (
	"berth/handlers"
	"berth/internal/server"
	"berth/models"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type (
	ServerInfo = models.ServerInfo

	ListServersResponse      = server.ListServersResponse
	ServerStatisticsResponse = server.ServerStatisticsResponse

	AdminListServersResponse    = server.AdminListServersResponse
	AdminCreateServerResponse   = server.AdminCreateServerResponse
	AdminUpdateServerResponse   = server.AdminUpdateServerResponse
	AdminDeleteServerResponse   = server.AdminDeleteServerResponse
	AdminTestConnectionResponse = server.AdminTestConnectionResponse
)

type SingleServerResponse struct {
	Server ServerInfo `json:"server"`
}

func TestServerEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "serversjwtuser",
		Email:    "serversjwtuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-jwt")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/summary", map[string]interface{}{
		"stacks": []map[string]interface{}{
			{"name": "stack1", "healthy": true},
			{"name": "stack2", "healthy": false},
		},
	})

	t.Run("GET /api/v1/servers returns servers list", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serversResp ListServersResponse
		require.NoError(t, resp.GetJSON(&serversResp))
		assert.NotEmpty(t, serversResp.Data.Servers)

		var found bool
		for _, s := range serversResp.Data.Servers {
			if s.Name == "test-server-jwt" {
				found = true
				assert.Equal(t, testServer.ID, s.ID)
				break
			}
		}
		assert.True(t, found, "test server should be in the list")
	})

	t.Run("GET /api/v1/servers/:id/statistics returns statistics", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/statistics", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/statistics",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp ServerStatisticsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
	})

	t.Run("GET /api/v1/admin/servers returns all servers", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/servers", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/servers",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serversResp AdminListServersResponse
		require.NoError(t, resp.GetJSON(&serversResp))
		assert.True(t, serversResp.Success)
		assert.NotEmpty(t, serversResp.Data.Servers)
	})

	t.Run("GET /api/v1/admin/servers/:id returns single server", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/servers/:id", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/servers/" + itoa(testServer.ID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serverResp SingleServerResponse
		require.NoError(t, resp.GetJSON(&serverResp))
		assert.Equal(t, testServer.ID, serverResp.Server.ID)
		assert.Equal(t, "test-server-jwt", serverResp.Server.Name)
	})

	t.Run("GET /api/v1/admin/servers/:id returns 404 for non-existent server", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/servers/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/servers/99999",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestServerCRUDOperations(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "serverscruduser",
		Email:    "serverscruduser@example.com",
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

	var createdServerID uint

	t.Run("POST /api/v1/admin/servers creates a new server", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/servers", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/servers",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"name":                  "new-test-server",
				"description":           "A test server",
				"host":                  "test.example.com",
				"port":                  8080,
				"skip_ssl_verification": true,
				"access_token":          "test-token",
				"is_active":             true,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var serverResp AdminCreateServerResponse
		require.NoError(t, resp.GetJSON(&serverResp))
		assert.True(t, serverResp.Success)
		assert.Equal(t, "new-test-server", serverResp.Data.Server.Name)
		assert.Equal(t, "A test server", serverResp.Data.Server.Description)
		createdServerID = serverResp.Data.Server.ID
	})

	t.Run("PUT /api/v1/admin/servers/:id updates a server", func(t *testing.T) {
		TagTest(t, "PUT", "/api/v1/admin/servers/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdServerID, "server must be created first")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "PUT",
			Path:   "/api/v1/admin/servers/" + itoa(createdServerID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"name":                  "updated-test-server",
				"description":           "Updated description",
				"host":                  "test.example.com",
				"port":                  9090,
				"skip_ssl_verification": false,
				"is_active":             false,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serverResp AdminUpdateServerResponse
		require.NoError(t, resp.GetJSON(&serverResp))
		assert.True(t, serverResp.Success)
		assert.Equal(t, "updated-test-server", serverResp.Data.Server.Name)
		assert.Equal(t, "Updated description", serverResp.Data.Server.Description)
		assert.Equal(t, 9090, serverResp.Data.Server.Port)
	})

	t.Run("DELETE /api/v1/admin/servers/:id deletes a server", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/admin/servers/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdServerID, "server must be created first")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/admin/servers/" + itoa(createdServerID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var deleteResp AdminDeleteServerResponse
		require.NoError(t, resp.GetJSON(&deleteResp))
		assert.True(t, deleteResp.Success)

		getResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/servers/" + itoa(createdServerID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, getResp.StatusCode)
	})
}

func TestServerTestConnection(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "servertestuser",
		Email:    "servertestuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	t.Run("POST /api/v1/admin/servers/:id/test succeeds with healthy agent", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/servers/:id/test", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-connection-server")
		mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/servers/" + itoa(testServer.ID) + "/test",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/servers/:id/test fails with unhealthy agent", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/servers/:id/test", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-connection-fail-server")
		mockAgent.SetError(500, "Internal Server Error")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/servers/" + itoa(testServer.ID) + "/test",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 503, resp.StatusCode)
	})
}

func TestServerEndpointsSessionAuth(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "serverssessionuser",
		Email:    "serverssessionuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	app.CreateTestServerWithAgent(t, "test-server-session")

	t.Run("GET /api/v1/servers works with session auth", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serversResp ListServersResponse
		require.NoError(t, resp.GetJSON(&serversResp))
		assert.NotEmpty(t, serversResp.Data.Servers)
	})

	t.Run("GET /api/v1/admin/servers works with session auth", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/servers", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/admin/servers")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var serversResp AdminListServersResponse
		require.NoError(t, resp.GetJSON(&serversResp))
		assert.True(t, serversResp.Success)
		assert.NotEmpty(t, serversResp.Data.Servers)
	})
}

func TestServerEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/servers requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/servers requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/servers", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/admin/servers")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func itoa(n uint) string {
	return strconv.FormatUint(uint64(n), 10)
}
