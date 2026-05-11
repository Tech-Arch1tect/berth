package e2e

import (
	"net/http"
	"testing"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/pkg/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIAuthLoginRateLimitIgnoresSuccessfulLogins(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimitokapi",
		Email:    "ratelimitokapi@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	for i := 1; i <= 30; i++ {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
			"username": user.Username,
			"password": user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode,
			"successful API login #%d must not be rate limited (200 excluded from CountNon2xx)", i)
	}

	for i := 1; i <= 25; i++ {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
			"username": user.Username,
			"password": "wrong",
		})
		require.NoError(t, err)
		require.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
			"bad API login #%d must not be rate limited (budget should still be full)", i)
	}

	resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
		"username": user.Username,
		"password": "wrong",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode,
		"26th failure must be blocked — proving only failures consumed the budget")
}
