package e2e

import (
	"net/http"
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareChainCompleteness(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "mwchain-admin",
		Email:    "mwchain-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)

	regular := &e2etesting.TestUser{
		Username: "mwchain-user",
		Email:    "mwchain-user@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, regular)

	roleBody := func(suffix string) map[string]any {
		return map[string]any{
			"name":        "mwchain-" + suffix,
			"description": "middleware chain probe: " + suffix,
		}
	}

	t.Run("A. no auth no session → RequireHybridAuth rejects with 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryNoAuth, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Post("/api/v1/admin/roles", roleBody("no-auth"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
			"if this flips to 200/201 the auth layer is missing; if it flips to 400/403 a different layer is rejecting first")
		assert.NotContains(t, strings.ToLower(resp.GetString()), "csrf",
			"unauthenticated requests must not be rejected by CSRF layer (ConditionalCSRFMiddleware should skip)")
	})

	t.Run("B. non-admin session with CSRF → RBAC rejects with 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, regular.Username, regular.Password)
		resp, err := sessionClient.Post("/api/v1/admin/roles", roleBody("non-admin"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"if this flips to 401, RequireHybridAuth is not accepting the session cookie; "+
				"if it flips to 400, CSRF is the rejecting layer (check auto-injection); "+
				"if 2xx, RBAC is not running")
	})

	t.Run("C. admin session without CSRF header → CSRF rejects with 400 (ordering check)", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

		loginResp, err := app.AuthHelper.Login(admin.Username, admin.Password)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, loginResp)
		sessionCookie := app.SessionHelper.GetSessionCookie(loginResp)
		require.NotNil(t, sessionCookie)

		barren := app.SessionHelper.WithSessionCookie(sessionCookie)

		resp, err := barren.Post("/api/v1/admin/roles", roleBody("admin-no-csrf"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
			"if this flips to 201, CSRF layer is missing on /api/v1/admin; "+
				"if 403, RBAC is running before CSRF (wrong order)")
		assert.Contains(t, strings.ToLower(resp.GetString()), "csrf",
			"rejection body should mention CSRF so operators can diagnose")
	})

	t.Run("D. admin session with Sec-Fetch-Site cross-site → CSRF fast-path rejects with 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
		resp, err := sessionClient.Request(&e2etesting.RequestOptions{
			Method: http.MethodPost,
			Path:   "/api/v1/admin/roles",
			Body:   roleBody("admin-cross-site"),
			Headers: map[string]string{
				"Sec-Fetch-Site": "cross-site",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"Sec-Fetch-Site: cross-site must be blocked at the CSRF layer with an immediate 403")
		assert.Contains(t, strings.ToLower(resp.GetString()), "cross-site",
			"echo's fast-path rejection body should mention 'cross-site'")
	})

	t.Run("E. admin session with valid CSRF → full chain accepts with 201", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
		resp, err := sessionClient.Post("/api/v1/admin/roles", roleBody("happy"))
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, resp.StatusCode,
			"full chain should accept: body=%s", resp.GetString())

		var createResp CreateRoleResponse
		require.NoError(t, resp.GetJSON(&createResp))
		assert.True(t, createResp.Success)
		assert.Equal(t, "mwchain-happy", createResp.Data.Name)
		assert.False(t, createResp.Data.IsAdmin,
			"handler ran and returned a real role, proving every layer between session and handler fired")

		resp2, err := sessionClient.Post("/api/v1/admin/roles", roleBody("happy-2"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp2.StatusCode, "body=%s", resp2.GetString())
	})
}
