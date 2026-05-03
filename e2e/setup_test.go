package e2e

import (
	"net/http"
	"net/url"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupAdminAlreadyCompleted(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	app.CreateAdminTestUser(t, &e2etesting.TestUser{
		Username: "rootadmin",
		Email:    "rootadmin@example.com",
		Password: "password123",
	})

	t.Run("GET /setup/admin redirects to /auth/login when admin exists", func(t *testing.T) {
		TagTest(t, "GET", "/setup/admin", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := client.Get("/setup/admin")
		require.NoError(t, err)
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/auth/login", resp.Header.Get("Location"))
	})

	t.Run("POST /setup/admin redirects to /auth/login when admin exists", func(t *testing.T) {
		TagTest(t, "POST", "/setup/admin", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, _ = client.Get("/setup/admin")
		resp, err := client.PostForm("/setup/admin", url.Values{
			"username":         {"intruder"},
			"email":            {"intruder@example.com"},
			"password":         {"password123"},
			"password_confirm": {"password123"},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/auth/login", resp.Header.Get("Location"))
	})
}
