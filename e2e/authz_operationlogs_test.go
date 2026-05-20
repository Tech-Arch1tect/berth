package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzOperationLogs_UserRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-oplog-u-admin",
		Email:    "authz-oplog-u-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	regular := &e2etesting.TestUser{
		Username: "authz-oplog-u-user",
		Email:    "authz-oplog-u-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)
	regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

	const url = "/api/v1/operation-logs"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(url)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT returns 200 (Authenticated rule admits any user)", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + regularJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("API key without logs.operations.read returns 403", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-oplog-u-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key with logs.operations.read returns 200", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-oplog-u-scoped"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    permnames.LogsOperationsRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestAuthzOperationLogs_AdminRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-oplog-a-admin",
		Email:    "authz-oplog-a-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
	adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	regular := &e2etesting.TestUser{
		Username: "authz-oplog-a-user",
		Email:    "authz-oplog-a-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)
	regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

	const url = "/api/v1/admin/operation-logs"

	t.Run("non-admin JWT returns 403", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + regularJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin JWT returns 200", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + adminJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("admin API key without admin.logs.read scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-oplog-a-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin API key with admin.logs.read scope returns 200", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-oplog-a-scoped"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    permnames.AdminLogsRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}
