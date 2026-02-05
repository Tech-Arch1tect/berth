package e2e

import (
	"testing"

	"berth/internal/apikey"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestAPIKeysSessionAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikeyuser",
		Email:    "apikeyuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "apikey-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	var createdAPIKeyID uint
	var createdScopeID uint

	t.Run("GET /api/v1/api-keys returns empty list initially", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result apikey.ListAPIKeysResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Empty(t, result.Data)
	})

	t.Run("POST /api/v1/api-keys creates new API key", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]interface{}{
			"name": "Test API Key",
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var result apikey.CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Equal(t, "Test API Key", result.Data.APIKey.Name)
		assert.NotEmpty(t, result.Data.PlainKey)
		assert.True(t, len(result.Data.PlainKey) > 10)
		createdAPIKeyID = result.Data.APIKey.ID
	})

	t.Run("POST /api/v1/api-keys requires name", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := sessionClient.Post("/api/v1/api-keys", map[string]interface{}{})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/v1/api-keys returns created key", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result apikey.ListAPIKeysResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Len(t, result.Data, 1)
		assert.Equal(t, "Test API Key", result.Data[0].Name)
	})

	t.Run("GET /api/v1/api-keys/:id returns single key", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys/:id", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/v1/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result apikey.GetAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Equal(t, createdAPIKeyID, result.Data.ID)
		assert.Equal(t, "Test API Key", result.Data.Name)
	})

	t.Run("GET /api/v1/api-keys/:id returns 404 for non-existent key", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/api-keys/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("GET /api/v1/api-keys/:id/scopes returns empty list initially", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys/:id/scopes", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/v1/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result apikey.ListScopesResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Empty(t, result.Data)
	})

	t.Run("POST /api/v1/api-keys/:id/scopes adds scope", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys/:id/scopes", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/v1/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"server_id":     testServer.ID,
			"stack_pattern": "test-*",
			"permission":    "stacks.read",
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var result apikey.MessageResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
	})

	t.Run("POST /api/v1/api-keys/:id/scopes requires stack_pattern", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys/:id/scopes", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/v1/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"permission": "stacks.read",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/api-keys/:id/scopes requires permission", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys/:id/scopes", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/v1/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"stack_pattern": "test-*",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/v1/api-keys/:id/scopes returns added scope", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys/:id/scopes", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/v1/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result apikey.ListScopesResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Len(t, result.Data, 1)
		assert.Equal(t, "test-*", result.Data[0].StackPattern)
		assert.Equal(t, "stacks.read", result.Data[0].Permission)
		createdScopeID = result.Data[0].ID
	})

	t.Run("DELETE /api/v1/api-keys/:id/scopes/:scopeId removes scope", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/api-keys/:id/scopes/:scopeId", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")
		require.NotZero(t, createdScopeID, "Scope must be created first")

		resp, err := sessionClient.Delete("/api/v1/api-keys/" + itoa(createdAPIKeyID) + "/scopes/" + itoa(createdScopeID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/v1/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		var result apikey.ListScopesResponse
		require.NoError(t, getResp.GetJSON(&result))
		assert.Empty(t, result.Data)
	})

	t.Run("DELETE /api/v1/api-keys/:id/scopes/:scopeId returns 404 for non-existent scope", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/api-keys/:id/scopes/:scopeId", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Delete("/api/v1/api-keys/" + itoa(createdAPIKeyID) + "/scopes/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/api-keys/:id revokes key", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/api-keys/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Delete("/api/v1/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/v1/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 404, getResp.StatusCode)
	})

	t.Run("DELETE /api/v1/api-keys/:id returns 404 for non-existent key", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/api-keys/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Delete("/api/v1/api-keys/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestAPIKeysNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /api/v1/api-keys requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/api-keys", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/api-keys requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Post("/api/v1/api-keys", map[string]interface{}{
			"name": "Test Key",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/api-keys/:id requires authentication", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/api-keys/:id", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Delete("/api/v1/api-keys/1")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
