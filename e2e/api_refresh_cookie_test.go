package e2e

import (
	"net/http"
	"testing"
	"time"

	"berth/internal/domain/auth"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const refreshCookieName = "berth_refresh"
const refreshCookiePath = "/api/v1/auth"

func findCookie(resp *e2etesting.Response, name string) *http.Cookie {
	for _, ck := range resp.Cookies() {
		if ck.Name == name {
			return ck
		}
	}
	return nil
}

func requireRefreshCookie(t *testing.T, resp *e2etesting.Response) *http.Cookie {
	t.Helper()
	ck := findCookie(resp, refreshCookieName)
	require.NotNil(t, ck, "expected %s cookie to be set on response", refreshCookieName)
	return ck
}

func assertRefreshCookieAttributes(t *testing.T, ck *http.Cookie) {
	t.Helper()
	assert.True(t, ck.HttpOnly, "cookie must be HttpOnly")
	assert.True(t, ck.Secure, "cookie must be Secure")
	assert.Equal(t, http.SameSiteStrictMode, ck.SameSite, "cookie must be SameSite=Strict")
	assert.Equal(t, refreshCookiePath, ck.Path, "cookie path must be %s", refreshCookiePath)
}

func TestAPIRefreshCookieSetOnLogin(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_login",
		Email:    "api_cookie_login@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	ck := requireRefreshCookie(t, resp)
	assertRefreshCookieAttributes(t, ck)
	assert.NotEmpty(t, ck.Value, "cookie value must be the refresh token")
	assert.Greater(t, ck.MaxAge, 0, "MaxAge must be positive (set, not delete)")
	assert.LessOrEqual(t, ck.MaxAge, int((30 * 24 * time.Hour).Seconds()),
		"MaxAge should not exceed configured refresh expiry (30d in test config)")

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, resp.GetJSON(&login))
	assert.Equal(t, login.Data.RefreshToken, ck.Value,
		"cookie value must equal the body refresh_token")
}

func TestAPIRefreshCookieSetOnTOTPVerify(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/totp/verify", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_totp",
		Email:    "api_cookie_totp@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	secret := seedValidTOTPSecret(t, app, user.ID)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	assert.Nil(t, findCookie(loginResp, refreshCookieName),
		"login that returns a TOTP challenge must not set the refresh cookie")

	var challenge response.Response[auth.AuthTOTPRequiredData]
	require.NoError(t, loginResp.GetJSON(&challenge))
	require.NotEmpty(t, challenge.Data.TemporaryToken)

	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	verifyResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/auth/totp/verify",
		Headers: map[string]string{
			"Authorization": "Bearer " + challenge.Data.TemporaryToken,
		},
		Body: auth.AuthTOTPVerifyRequest{Code: code},
	})
	require.NoError(t, err)
	require.Equal(t, 200, verifyResp.StatusCode)

	ck := requireRefreshCookie(t, verifyResp)
	assertRefreshCookieAttributes(t, ck)
	assert.Greater(t, ck.MaxAge, 0)

	var verify response.Response[auth.AuthLoginData]
	require.NoError(t, verifyResp.GetJSON(&verify))
	assert.Equal(t, verify.Data.RefreshToken, ck.Value)
}

func TestAPIRefreshCookieOnlyRefresh(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_refresh",
		Email:    "api_cookie_refresh@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	loginCookie := requireRefreshCookie(t, loginResp)

	refreshResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/auth/refresh",
		Body:    auth.AuthRefreshRequest{RefreshToken: ""},
		Cookies: []*http.Cookie{loginCookie},
	})
	require.NoError(t, err)
	require.Equal(t, 200, refreshResp.StatusCode)

	rotated := requireRefreshCookie(t, refreshResp)
	assertRefreshCookieAttributes(t, rotated)
	assert.NotEqual(t, loginCookie.Value, rotated.Value, "rotated cookie value must differ from the original")

	var refresh response.Response[auth.AuthRefreshData]
	require.NoError(t, refreshResp.GetJSON(&refresh))
	assert.Equal(t, refresh.Data.RefreshToken, rotated.Value, "cookie value must equal body refresh_token after rotation")

	staleResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/auth/refresh",
		Body:    auth.AuthRefreshRequest{RefreshToken: ""},
		Cookies: []*http.Cookie{loginCookie},
	})
	require.NoError(t, err)
	assert.Equal(t, 401, staleResp.StatusCode, "old refresh cookie value must not work after rotation")
}

func TestAPIRefreshCookieOnlyLogout(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/logout", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_logout",
		Email:    "api_cookie_logout@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	loginCookie := requireRefreshCookie(t, loginResp)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))

	logoutResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/auth/logout",
		Body:    auth.AuthLogoutRequest{RefreshToken: ""},
		Cookies: []*http.Cookie{loginCookie},
		Headers: map[string]string{
			"Authorization": "Bearer " + login.Data.AccessToken,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 200, logoutResp.StatusCode)

	var logout response.Response[auth.AuthLogoutData]
	require.NoError(t, logoutResp.GetJSON(&logout))
	assert.Contains(t, logout.Data.RevokedTokens, "refresh_token", "cookie-supplied refresh must be revoked")

	cleared := findCookie(logoutResp, refreshCookieName)
	require.NotNil(t, cleared, "logout must always emit a Set-Cookie clearing berth_refresh")
	assert.Equal(t, refreshCookiePath, cleared.Path)
	assert.Equal(t, "", cleared.Value, "cleared cookie must have empty value")
	assert.True(t, cleared.MaxAge < 0 || (!cleared.Expires.IsZero() && cleared.Expires.Before(time.Now())),
		"cleared cookie must have MaxAge<0 or a past Expires")

	staleResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/auth/refresh",
		Body:    auth.AuthRefreshRequest{RefreshToken: ""},
		Cookies: []*http.Cookie{loginCookie},
	})
	require.NoError(t, err)
	assert.Equal(t, 401, staleResp.StatusCode, "refresh cookie value must not work after logout revoked it")
}

func TestAPIRefreshBodyWinsOverCookie(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryEdgeCase, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_precedence",
		Email:    "api_cookie_precedence@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginA, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	cookieA := requireRefreshCookie(t, loginA)

	loginB, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	var bodyB response.Response[auth.AuthLoginData]
	require.NoError(t, loginB.GetJSON(&bodyB))
	bodyTokenB := bodyB.Data.RefreshToken
	require.NotEqual(t, cookieA.Value, bodyTokenB, "two logins must yield distinct refresh tokens")

	refreshResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/auth/refresh",
		Body:    auth.AuthRefreshRequest{RefreshToken: bodyTokenB},
		Cookies: []*http.Cookie{cookieA},
	})
	require.NoError(t, err)
	require.Equal(t, 200, refreshResp.StatusCode)

	cookieARemainsValid, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
		RefreshToken: cookieA.Value,
	})
	require.NoError(t, err)
	assert.Equal(t, 200, cookieARemainsValid.StatusCode,
		"cookie's token must be untouched when body wins (only body's token rotates)")

	bodyTokenBRotated, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
		RefreshToken: bodyTokenB,
	})
	require.NoError(t, err)
	assert.Equal(t, 401, bodyTokenBRotated.StatusCode, "body's token must be the one that got rotated")
}

func TestAPIRefreshBodyFlowRegression(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryIntegration, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "api_cookie_body_regression",
		Email:    "api_cookie_body_regression@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	require.NotEmpty(t, login.Data.RefreshToken, "body must continue to return refresh_token for non-browser clients")

	refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
		RefreshToken: login.Data.RefreshToken,
	})
	require.NoError(t, err)
	assert.Equal(t, 200, refreshResp.StatusCode, "body-only refresh (no cookie) must still work for mobile/CLI")

	var refresh response.Response[auth.AuthRefreshData]
	require.NoError(t, refreshResp.GetJSON(&refresh))
	assert.NotEmpty(t, refresh.Data.AccessToken)
	assert.NotEmpty(t, refresh.Data.RefreshToken)
}
