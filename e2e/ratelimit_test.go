package e2e

import (
	"fmt"
	"net/http"
	"strconv"
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

func TestAPIAuthRateLimitIgnoresUserAgentRotation(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimituarot",
		Email:    "ratelimituarot@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	badLogin := func(userAgent string) int {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  http.MethodPost,
			Path:    "/api/v1/auth/login",
			Body:    map[string]string{"username": user.Username, "password": "wrong"},
			Headers: map[string]string{"User-Agent": userAgent},
		})
		require.NoError(t, err)
		return resp.StatusCode
	}

	TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	for i := 1; i <= 25; i++ {
		require.NotEqual(t, http.StatusTooManyRequests, badLogin(fmt.Sprintf("agent-%d", i)),
			"bad login #%d must still be within budget", i)
	}
	assert.Equal(t, http.StatusTooManyRequests, badLogin("agent-final"),
		"rotating the User-Agent must not earn a fresh budget — the bucket keys on IP")
}

func TestRateLimitBucketScope(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimitscope",
		Email:    "ratelimitscope@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	exhausted := false
	for i := 1; i <= 40; i++ {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
			"username": user.Username, "password": "wrong",
		})
		require.NoError(t, err)
		if resp.StatusCode == http.StatusTooManyRequests {
			exhausted = true
			break
		}
	}
	require.True(t, exhausted, "repeated bad logins should exhaust the api_auth bucket")

	t.Run("all auth routes share the api_auth bucket", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", map[string]string{"refresh_token": "irrelevant"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode,
			"another /api/v1/auth route shares the same per-IP bucket and is throttled too")
	})

	t.Run("the protected-API bucket is independent of the auth bucket", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Get("/api/v1/profile")
		require.NoError(t, err)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
			"the api_general bucket is separate — exhausting api_auth must not throttle protected routes")
	})
}

func TestRateLimitHeadersPresent(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimithdr",
		Email:    "ratelimithdr@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	assertHeaders := func(t *testing.T, resp *e2etesting.Response, wantRemaining string) {
		t.Helper()
		limit := resp.Header.Get("X-RateLimit-Limit")
		remaining := resp.Header.Get("X-RateLimit-Remaining")
		reset := resp.Header.Get("X-RateLimit-Reset")
		for name, value := range map[string]string{
			"X-RateLimit-Limit": limit, "X-RateLimit-Remaining": remaining, "X-RateLimit-Reset": reset,
		} {
			require.NotEmpty(t, value, "%s must be set", name)
			_, err := strconv.Atoi(value)
			assert.NoError(t, err, "%s must be an integer, got %q", name, value)
		}
		if wantRemaining != "" {
			assert.Equal(t, wantRemaining, remaining)
		}
	}

	t.Run("headers present on a normal response", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryEdgeCase, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
			"username": user.Username, "password": user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assertHeaders(t, resp, "")
	})

	t.Run("headers present on a 429 with zero remaining", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategorySecurity, e2etesting.ValueMedium)
		var limited *e2etesting.Response
		for i := 1; i <= 40; i++ {
			resp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
				"username": user.Username, "password": "wrong",
			})
			require.NoError(t, err)
			if resp.StatusCode == http.StatusTooManyRequests {
				limited = resp
				break
			}
		}
		require.NotNil(t, limited, "expected a 429 after repeated bad logins")
		assertHeaders(t, limited, "0")
	})
}
