package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzAPIKey_ListRejectsAPIKey(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-apikey-admin",
		Email:    "authz-apikey-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
	adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

	const listURL = "/api/v1/api-keys"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(listURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT is admitted", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + adminJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("API key is rejected with 403 (APIKeyDenied rule)", func(t *testing.T) {
		TagTest(t, "GET", listURL, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-apikey-self"})
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
}
