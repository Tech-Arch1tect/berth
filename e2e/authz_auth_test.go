package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzAuth_PublicLoginRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "authz-auth-login-user",
		Email:    "authz-auth-login-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("login succeeds without prior authentication (Public rule)", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]any{
			"username": user.Username,
			"password": user.Password,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "Public-ruled login must succeed for valid credentials; body=%s", resp.GetString())
	})
}

func TestAuthzAuth_ProfileAllowsAnyAuthenticated(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "authz-auth-profile-user",
		Email:    "authz-auth-profile-user@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	jwt := app.AuthHelper.JWTLogin(t, user.Username, user.Password)

	const url = "/api/v1/profile"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(url)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT returns 200", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("API key returns 200 (Authenticated rule admits any principal)", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-auth-profile-key"})
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
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestAuthzAuth_LogoutRejectsAPIKey(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "authz-auth-logout-user",
		Email:    "authz-auth-logout-user@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	const url = "/api/v1/auth/logout"

	t.Run("API key is rejected with 403 (APIKeyDenied)", func(t *testing.T) {
		TagTest(t, "POST", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-auth-logout-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzAuth_SessionsRejectsAPIKey(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "authz-auth-sess-user",
		Email:    "authz-auth-sess-user@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	const url = "/api/v1/sessions"

	t.Run("API key is rejected with 403 (APIKeyDenied)", func(t *testing.T) {
		TagTest(t, "GET", url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-auth-sess-key"})
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
}
