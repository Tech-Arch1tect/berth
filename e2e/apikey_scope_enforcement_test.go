package e2e

import (
	"testing"

	"berth/internal/apikey"
	"berth/internal/rbac"
	"berth/internal/stack"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestAPIKeyScopeEnforcement(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "scopetest",
		Email:    "scopetest@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "scope-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "test-stack", "status": "running"},
		{"name": "prod-stack", "status": "running"},
		{"name": "other-stack", "status": "stopped"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack", map[string]any{
		"name":   "test-stack",
		"status": "running",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/prod-stack", map[string]any{
		"name":   "prod-stack",
		"status": "running",
	})

	createAPIKey := func(t *testing.T, name string) (uint, string) {
		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": name,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		return result.Data.APIKey.ID, result.Data.PlainKey
	}

	addScope := func(t *testing.T, apiKeyID uint, serverID *uint, stackPattern, permission string) {
		payload := map[string]any{
			"stack_pattern": stackPattern,
			"permission":    permission,
		}
		if serverID != nil {
			payload["server_id"] = *serverID
		}

		resp, err := sessionClient.Post("/api/v1/api-keys/"+itoa(apiKeyID)+"/scopes", payload)
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode, "failed to add scope")
	}

	apiRequest := func(method, path, apiKey string) (*e2etesting.Response, error) {
		return app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: method,
			Path:   path,
			Headers: map[string]string{
				"Authorization": "Bearer " + apiKey,
			},
		})
	}

	t.Run("API key without scopes is denied server access", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "no-scope-key")
		_ = keyID

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
		require.NoError(t, err)

		assert.Equal(t, 500, resp.StatusCode, "API key without scopes should be denied access to server")
	})

	t.Run("API key with correct scope can access matching stacks", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "scoped-key")
		serverID := testServer.ID
		addScope(t, keyID, &serverID, "*", rbac.PermStacksRead)

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result stack.ListStacksResponse
		require.NoError(t, resp.GetJSON(&result))

		assert.True(t, result.Success)
		assert.NotEmpty(t, result.Data.Stacks, "API key with * scope should see stacks")
	})

	t.Run("API key with specific stack pattern only sees matching stacks", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "pattern-key")
		serverID := testServer.ID
		addScope(t, keyID, &serverID, "test-*", rbac.PermStacksRead)

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result stack.ListStacksResponse
		require.NoError(t, resp.GetJSON(&result))

		assert.True(t, result.Success)
		assert.NotEmpty(t, result.Data.Stacks, "Should see at least one stack")
		for _, s := range result.Data.Stacks {
			assert.Contains(t, s.Name, "test-", "API key with test-* pattern should only see test-* stacks, got: %s", s.Name)
		}
	})

	t.Run("API key scoped to wrong server is denied access", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		mockAgent2, testServer2 := app.CreateTestServerWithAgent(t, "other-server")
		mockAgent2.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
		mockAgent2.RegisterJSONHandler("/api/stacks", []map[string]any{
			{"name": "server2-stack", "status": "running"},
		})

		keyID, plainKey := createAPIKey(t, "server-scoped-key")

		server2ID := testServer2.ID
		addScope(t, keyID, &server2ID, "*", rbac.PermStacksRead)

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
		require.NoError(t, err)

		assert.Equal(t, 500, resp.StatusCode, "API key scoped to different server should be denied access")
	})

	t.Run("API key with read scope cannot perform manage operations", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "read-only-key")
		serverID := testServer.ID

		addScope(t, keyID, &serverID, "*", rbac.PermStacksRead)

		mockAgent.RegisterJSONHandler("/api/stacks/test-stack", map[string]any{
			"name":       "test-stack",
			"status":     "running",
			"containers": []any{},
		})

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks/test-stack", plainKey)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "Read operation should succeed with stacks.read scope")

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "PATCH",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/compose",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
				"Content-Type":  "application/json",
			},
			Body: map[string]any{
				"services": map[string]any{},
			},
		})
		require.NoError(t, err)

		assert.True(t, resp.StatusCode == 403 || resp.StatusCode == 500,
			"Manage operation should fail with read-only scope, got: %d", resp.StatusCode)
	})

	t.Run("API key with manage scope can perform operations", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "manage-key")
		serverID := testServer.ID
		addScope(t, keyID, &serverID, "test-*", rbac.PermStacksManage)

		mockAgent.RegisterJSONHandler("/api/stacks/test-stack/operations", map[string]any{
			"operation_id": "test-op-123",
			"status":       "started",
		})

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/operations",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
				"Content-Type":  "application/json",
			},
			Body: map[string]any{
				"command": "restart",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "Operation should succeed with stacks.manage scope")
	})

	t.Run("API key with null server_id scope works for all servers", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "all-servers-key")

		addScope(t, keyID, nil, "*", rbac.PermStacksRead)

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result stack.ListStacksResponse
		require.NoError(t, resp.GetJSON(&result))

		assert.True(t, result.Success)
		assert.NotEmpty(t, result.Data.Stacks, "API key with null server_id should see stacks on any server")
	})

	t.Run("API key permissions endpoint reflects scope-filtered permissions", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/permissions", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		keyID, plainKey := createAPIKey(t, "permission-check-key")
		serverID := testServer.ID

		addScope(t, keyID, &serverID, "*", rbac.PermStacksRead)

		resp, err := apiRequest("GET", "/api/v1/servers/"+itoa(testServer.ID)+"/stacks/test-stack/permissions", plainKey)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result stack.StackPermissionsResponse
		require.NoError(t, resp.GetJSON(&result))

		assert.True(t, result.Success)
		if len(result.Data.Permissions) > 0 {
			assert.Contains(t, result.Data.Permissions, rbac.PermStacksRead, "Should have stacks.read permission")

			for _, perm := range result.Data.Permissions {
				assert.NotEqual(t, rbac.PermStacksManage, perm, "Should not have stacks.manage permission when key only has read scope")
			}
		}
	})
}

func TestAPIKeyAuthenticationVsAuthorization(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "authtest",
		Email:    "authtest@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "auth-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})

	t.Run("Invalid API key returns 401 Unauthorized", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks",
			Headers: map[string]string{
				"Authorization": "Bearer brth_invalidkey123456789012345678901234",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode, "Invalid API key should return 401")
	})

	t.Run("Valid API key with non-matching scope is denied access", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": "mismatched-scope-key",
		})
		require.NoError(t, err)
		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		plainKey := result.Data.PlainKey
		keyID := result.Data.APIKey.ID

		mockAgent2, testServer2 := app.CreateTestServerWithAgent(t, "scope-target-server")
		mockAgent2.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

		serverID := testServer2.ID
		resp, err = sessionClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     serverID,
			"stack_pattern": "nonexistent-*",
			"permission":    rbac.PermStacksRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
			},
		})
		require.NoError(t, err)

		assert.Equal(t, 500, resp.StatusCode, "Valid API key without matching scope should be denied")
	})

	t.Run("Missing Authorization header returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode, "Missing auth should return 401")
	})
}

func TestAPIKeyFilesAccess(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "filestest",
		Email:    "filestest@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "files-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "test-stack", "status": "running"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files", map[string]any{
		"path":  "/",
		"files": []map[string]any{{"name": "docker-compose.yml", "type": "file"}},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/read", map[string]any{
		"content": "version: '3'\nservices: {}",
		"path":    "docker-compose.yml",
	})

	t.Run("API key with files.read scope can list files", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": "files-read-key",
		})
		require.NoError(t, err)
		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		plainKey := result.Data.PlainKey
		keyID := result.Data.APIKey.ID

		serverID := testServer.ID
		resp, err = sessionClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     serverID,
			"stack_pattern": "*",
			"permission":    rbac.PermFilesRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "Should be able to list files with files.read scope")
	})

	t.Run("API key without files.read scope cannot list files", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": "no-files-key",
		})
		require.NoError(t, err)
		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		plainKey := result.Data.PlainKey
		keyID := result.Data.APIKey.ID

		serverID := testServer.ID
		resp, err = sessionClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     serverID,
			"stack_pattern": "*",
			"permission":    rbac.PermStacksRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
			},
		})
		require.NoError(t, err)

		assert.True(t, resp.StatusCode == 403 || resp.StatusCode == 500,
			"Should not be able to list files without files.read scope, got: %d", resp.StatusCode)
	})
}

func TestAPIKeyLogsAccess(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "logstest",
		Email:    "logstest@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "logs-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "test-stack", "status": "running"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/logs", map[string]any{
		"logs": []map[string]any{
			{
				"timestamp": "2024-01-15T10:30:00Z",
				"message":   "test log output",
				"source":    "web-1",
				"level":     "info",
			},
		},
	})

	t.Run("API key with logs.read scope can read logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": "logs-read-key",
		})
		require.NoError(t, err)
		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		plainKey := result.Data.PlainKey
		keyID := result.Data.APIKey.ID

		serverID := testServer.ID
		resp, err = sessionClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     serverID,
			"stack_pattern": "*",
			"permission":    rbac.PermLogsRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "Should be able to read logs with logs.read scope")
	})

	t.Run("API key without logs.read scope cannot read logs", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
			"name": "no-logs-key",
		})
		require.NoError(t, err)
		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		plainKey := result.Data.PlainKey
		keyID := result.Data.APIKey.ID

		serverID := testServer.ID
		resp, err = sessionClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     serverID,
			"stack_pattern": "*",
			"permission":    rbac.PermStacksRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, resp.StatusCode)

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + plainKey,
			},
		})
		require.NoError(t, err)

		assert.True(t, resp.StatusCode == 403 || resp.StatusCode == 500,
			"Should not be able to read logs without logs.read scope, got: %d", resp.StatusCode)
	})
}
