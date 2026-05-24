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

func TestAuthzDataExport_ExportRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-export-admin",
		Email:    "authz-export-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
	adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	regular := &e2etesting.TestUser{
		Username: "authz-export-user",
		Email:    "authz-export-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)
	regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

	const url = "/api/v1/admin/migration/export"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Post(url, map[string]any{})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("non-admin JWT returns 403", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    url,
			Body:    map[string]any{},
			Headers: map[string]string{"Authorization": "Bearer " + regularJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin JWT is admitted (not 401/403)", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    url,
			Body:    map[string]any{},
			Headers: map[string]string{"Authorization": "Bearer " + adminJWT},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("admin API key without admin.system.export scope returns 403", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-export-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    url,
			Body:    map[string]any{},
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin API key with admin.system.export scope is admitted", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-export-scoped"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    permnames.AdminSystemExport,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    url,
			Body:    map[string]any{},
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})
}
