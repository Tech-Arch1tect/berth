package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type APIKeyResponse struct {
	ID        uint    `json:"id"`
	Name      string  `json:"name"`
	KeyPrefix string  `json:"key_prefix"`
	ExpiresAt *string `json:"expires_at"`
	CreatedAt string  `json:"created_at"`
	LastUsed  *string `json:"last_used"`
}

type APIKeyScopeResponse struct {
	ID           uint   `json:"id"`
	APIKeyID     uint   `json:"api_key_id"`
	ServerID     *uint  `json:"server_id"`
	StackPattern string `json:"stack_pattern"`
	Permission   string `json:"permission"`
}

type APIKeysListResponse struct {
	Success bool             `json:"success"`
	Data    []APIKeyResponse `json:"data"`
}

type SingleAPIKeyResponse struct {
	Success bool           `json:"success"`
	Data    APIKeyResponse `json:"data"`
}

type CreateAPIKeyResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		APIKey   APIKeyResponse `json:"api_key"`
		PlainKey string         `json:"plain_key"`
	} `json:"data"`
}

type APIKeyScopesListResponse struct {
	Success bool                  `json:"success"`
	Data    []APIKeyScopeResponse `json:"data"`
}

type SuccessMessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func TestAPIKeysSessionAuth(t *testing.T) {
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

	t.Run("GET /api/api-keys returns empty list initially", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result APIKeysListResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Empty(t, result.Data)
	})

	t.Run("POST /api/api-keys creates new API key", func(t *testing.T) {
		resp, err := sessionClient.Post("/api/api-keys", map[string]interface{}{
			"name": "Test API Key",
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var result CreateAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Equal(t, "Test API Key", result.Data.APIKey.Name)
		assert.NotEmpty(t, result.Data.PlainKey)
		assert.True(t, len(result.Data.PlainKey) > 10)
		createdAPIKeyID = result.Data.APIKey.ID
	})

	t.Run("POST /api/api-keys requires name", func(t *testing.T) {
		resp, err := sessionClient.Post("/api/api-keys", map[string]interface{}{})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/api-keys returns created key", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result APIKeysListResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Len(t, result.Data, 1)
		assert.Equal(t, "Test API Key", result.Data[0].Name)
	})

	t.Run("GET /api/api-keys/:id returns single key", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result SingleAPIKeyResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Equal(t, createdAPIKeyID, result.Data.ID)
		assert.Equal(t, "Test API Key", result.Data.Name)
	})

	t.Run("GET /api/api-keys/:id returns 404 for non-existent key", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/api-keys/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("GET /api/api-keys/:id/scopes returns empty list initially", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result APIKeyScopesListResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Empty(t, result.Data)
	})

	t.Run("POST /api/api-keys/:id/scopes adds scope", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"server_id":     testServer.ID,
			"stack_pattern": "test-*",
			"permission":    "stacks.read",
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var result SuccessMessageResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
	})

	t.Run("POST /api/api-keys/:id/scopes requires stack_pattern", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"permission": "stacks.read",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/api-keys/:id/scopes requires permission", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Post("/api/api-keys/"+itoa(createdAPIKeyID)+"/scopes", map[string]interface{}{
			"stack_pattern": "test-*",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/api-keys/:id/scopes returns added scope", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Get("/api/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result APIKeyScopesListResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.Len(t, result.Data, 1)
		assert.Equal(t, "test-*", result.Data[0].StackPattern)
		assert.Equal(t, "stacks.read", result.Data[0].Permission)
		createdScopeID = result.Data[0].ID
	})

	t.Run("DELETE /api/api-keys/:id/scopes/:scopeId removes scope", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")
		require.NotZero(t, createdScopeID, "Scope must be created first")

		resp, err := sessionClient.Delete("/api/api-keys/" + itoa(createdAPIKeyID) + "/scopes/" + itoa(createdScopeID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/api-keys/" + itoa(createdAPIKeyID) + "/scopes")
		require.NoError(t, err)
		var result APIKeyScopesListResponse
		require.NoError(t, getResp.GetJSON(&result))
		assert.Empty(t, result.Data)
	})

	t.Run("DELETE /api/api-keys/:id/scopes/:scopeId returns 404 for non-existent scope", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Delete("/api/api-keys/" + itoa(createdAPIKeyID) + "/scopes/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("DELETE /api/api-keys/:id revokes key", func(t *testing.T) {
		require.NotZero(t, createdAPIKeyID, "API key must be created first")

		resp, err := sessionClient.Delete("/api/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/api-keys/" + itoa(createdAPIKeyID))
		require.NoError(t, err)
		assert.Equal(t, 404, getResp.StatusCode)
	})

	t.Run("DELETE /api/api-keys/:id returns 404 for non-existent key", func(t *testing.T) {
		resp, err := sessionClient.Delete("/api/api-keys/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestAPIKeysNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/api-keys redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Get("/api/api-keys")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("POST /api/api-keys redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Post("/api/api-keys", map[string]interface{}{
			"name": "Test Key",
		})
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("DELETE /api/api-keys/:id redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Delete("/api/api-keys/1")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})
}
