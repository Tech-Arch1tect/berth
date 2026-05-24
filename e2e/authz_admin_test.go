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

func TestAuthzAdmin_UsersRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-admin-u-admin",
		Email:    "authz-admin-u-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
	adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	regular := &e2etesting.TestUser{
		Username: "authz-admin-u-user",
		Email:    "authz-admin-u-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)
	regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

	const listURL = "/api/v1/admin/users"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(listURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("non-admin JWT returns 403", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + regularJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin JWT returns 200", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + adminJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("admin API key without admin.users.read scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-admin-u-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("admin API key with admin.users.read scope returns 200", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-admin-u-scoped"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    permnames.AdminUsersRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestAuthzAdmin_PermissionsRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-admin-p-admin",
		Email:    "authz-admin-p-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
	adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	regular := &e2etesting.TestUser{
		Username: "authz-admin-p-user",
		Email:    "authz-admin-p-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)
	regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

	const url = "/api/v1/admin/permissions"

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

	t.Run("admin API key without admin.permissions.read scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-admin-p-noscope"})
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

	t.Run("admin API key with admin.permissions.read scope returns 200", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-admin-p-scoped"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    permnames.AdminPermissionsRead,
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
