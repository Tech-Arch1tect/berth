package e2e

import (
	"encoding/json"
	"net/http"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardSessionAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "dashboardsessionuser",
		Email:    "dashboardsessionuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	t.Run("GET / redirects unauthenticated to login", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.WithoutRedirects().Get("/")
		require.NoError(t, err)
		app.SessionHelper.AssertAuthenticationRequired(t, resp)
	})

	t.Run("GET / returns dashboard for authenticated user", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
		_, testServer := app.CreateTestServerWithAgent(t, "dashboard-server")

		resp, err := sessionClient.Request(&e2etesting.RequestOptions{
			Method: http.MethodGet,
			Path:   "/",
			Headers: map[string]string{
				"X-Inertia":         "true",
				"X-Inertia-Version": "",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		props := extractInertiaJSONFromResponse(t, resp)
		assert.Equal(t, "Dashboard", props["component"])

		servers, ok := props["props"].(map[string]any)
		require.True(t, ok, "props should contain servers")
		assert.Contains(t, servers, "servers")

		_ = testServer
	})
}

func extractInertiaJSONFromResponse(t *testing.T, resp *e2etesting.Response) map[string]any {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "application/json",
		"X-Inertia request should return JSON")

	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal(resp.Body, &page),
		"failed to parse Inertia JSON: %s", string(resp.Body))
	require.NotNil(t, page.Props, "props should not be nil")

	return map[string]any{
		"component": page.Component,
		"props":     page.Props,
	}
}
