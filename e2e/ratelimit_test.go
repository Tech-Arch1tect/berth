package e2e

import (
	"net/http"
	"net/url"
	"strconv"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthLoginRateLimit(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimituser",
		Email:    "ratelimit@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("five consecutive bad logins allowed, sixth blocked with 429", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

		for i := 1; i <= 5; i++ {
			resp, err := app.AuthHelper.Login(user.Username, "wrong-"+strconv.Itoa(i))
			require.NoError(t, err)
			assert.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
				"bad login #%d must not be rate limited (Rate=5 allows 5 failures)", i)
		}

		resp, err := app.AuthHelper.Login(user.Username, "wrong-6")
		require.NoError(t, err)
		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode,
			"6th bad login must be blocked with 429; body=%s", resp.GetString())

		assert.Equal(t, "5", resp.Header.Get("X-RateLimit-Limit"))
		assert.Equal(t, "0", resp.Header.Get("X-RateLimit-Remaining"))
		reset, err := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64)
		require.NoError(t, err, "X-RateLimit-Reset must be a unix timestamp")
		assert.True(t, reset > time.Now().Unix(), "Reset must be in the future")
	})
}

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

func TestAuthLoginRateLimitUserAgentRotationDoesNotBypass(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimitua",
		Email:    "ratelimitua@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	_, err := client.Request(&e2etesting.RequestOptions{
		Method: http.MethodGet,
		Path:   "/auth/login",
	})
	require.NoError(t, err)

	attack := func(i int) *e2etesting.Response {
		resp, err := client.Request(&e2etesting.RequestOptions{
			Method:   http.MethodPost,
			Path:     "/auth/login",
			FormData: url.Values{"username": {user.Username}, "password": {"wrong"}},
			Headers:  map[string]string{"User-Agent": "attacker-rotating-" + strconv.Itoa(i)},
		})
		require.NoError(t, err)
		return resp
	}

	for i := 1; i <= 5; i++ {
		resp := attack(i)
		require.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
			"failure #%d (UA rotated) must pass the limiter (within budget)", i)
	}

	resp := attack(6)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode,
		"rotating User-Agent must NOT grant an attacker extra brute-force budget; body=%s", resp.GetString())
}

func TestAuthGetLoginPageDoesNotConsumeLoginBucket(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	TagTest(t, "GET", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	for i := 1; i <= 20; i++ {
		resp, err := app.HTTPClient.Get("/auth/login")
		require.NoError(t, err)
		require.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
			"GET /auth/login #%d must not be rate limited (page renders don't consume the login bucket)", i)
	}

	user := &e2etesting.TestUser{
		Username: "pagerenderuser",
		Email:    "pagerender@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	for i := 1; i <= 5; i++ {
		resp, err := app.AuthHelper.Login(user.Username, "wrong-"+strconv.Itoa(i))
		require.NoError(t, err)
		require.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
			"bad login #%d must not be rate limited — page renders should not have consumed login budget", i)
	}

	resp, err := app.AuthHelper.Login(user.Username, "wrong-final")
	require.NoError(t, err)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode,
		"6th bad login must still trip the tight POST-only login bucket")
}

func TestAuthBucketsAreIsolatedPerRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "isolationuser",
		Email:    "isolation@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	for i := 1; i <= 5; i++ {
		resp, err := app.AuthHelper.Login(user.Username, "wrong-"+strconv.Itoa(i))
		require.NoError(t, err)
		require.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode)
	}

	resp, err := app.AuthHelper.Login(user.Username, "wrong-final")
	require.NoError(t, err)
	require.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "login bucket exhausted")

	resp, err = app.HTTPClient.PostForm("/auth/password-reset", url.Values{"email": {"nobody@example.com"}})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode,
		"password-reset bucket must be independent from login bucket")
}

func TestAuthGroupCeilingTripsAbove60PerMinute(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	TagTest(t, "GET", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()

	var tripped bool
	var lastCode int
	for i := 1; i <= 65; i++ {
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		lastCode = resp.StatusCode
		if resp.StatusCode == http.StatusTooManyRequests {
			tripped = true
			assert.GreaterOrEqual(t, i, 61,
				"group ceiling must not trip before 61 requests; tripped at %d", i)
			break
		}
	}

	assert.True(t, tripped, "group ceiling must trip within 65 GETs; last status=%d", lastCode)
}

func TestAuthLoginRateLimitHeaders(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(c *config.Config) { c.RateLimit.Enabled = true })

	user := &e2etesting.TestUser{
		Username: "ratelimithdr",
		Email:    "ratelimithdr@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

	observed := make([]string, 0, 5)
	for i := 1; i <= 5; i++ {
		resp, err := app.AuthHelper.Login(user.Username, "wrong")
		require.NoError(t, err)
		require.Equal(t, "5", resp.Header.Get("X-RateLimit-Limit"))
		remaining := resp.Header.Get("X-RateLimit-Remaining")
		require.NotEmpty(t, remaining)
		observed = append(observed, remaining)
	}

	for i := 1; i < len(observed); i++ {
		prev, _ := strconv.Atoi(observed[i-1])
		cur, _ := strconv.Atoi(observed[i])
		assert.LessOrEqual(t, cur, prev,
			"X-RateLimit-Remaining must not increase between requests: %v", observed)
	}
	last, _ := strconv.Atoi(observed[len(observed)-1])
	assert.Equal(t, 0, last, "after 5 failures, Remaining must be 0; saw %v", observed)
}
