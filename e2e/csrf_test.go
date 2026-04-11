package e2e

import (
	"encoding/json"
	"html"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	csrfCookieName     = "_csrf"
	csrfFetchSiteDummy = "_echo_csrf_using_sec_fetch_site_"
	csrfTokenLen       = 32
)

func getCSRFCookie(t *testing.T, client *e2etesting.HTTPClient) *http.Cookie {
	t.Helper()
	u, err := url.Parse(client.BaseURL)
	require.NoError(t, err)
	for _, ck := range client.Client.Jar.Cookies(u) {
		if ck.Name == csrfCookieName {
			return ck
		}
	}
	return nil
}

var dataPageRE = regexp.MustCompile(`data-page="([^"]*)"`)

func extractInertiaCSRFToken(t *testing.T, body []byte) string {
	t.Helper()
	m := dataPageRE.FindSubmatch(body)
	require.NotNil(t, m, "data-page attribute not found in HTML response")
	decoded := html.UnescapeString(string(m[1]))
	var page struct {
		Props map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal([]byte(decoded), &page),
		"failed to parse data-page JSON: %s", decoded)
	tok, _ := page.Props["csrfToken"].(string)
	return tok
}

func findSetCookie(resp *e2etesting.Response, name string) *http.Cookie {
	for _, ck := range resp.Cookies() {
		if ck.Name == name {
			return ck
		}
	}
	return nil
}

func getWithHeaders(c *e2etesting.HTTPClient, path string, headers map[string]string) (*e2etesting.Response, error) {
	return c.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    path,
		Headers: headers,
	})
}

func postFormWithHeaders(c *e2etesting.HTTPClient, path string, form url.Values, headers map[string]string) (*e2etesting.Response, error) {
	return c.Request(&e2etesting.RequestOptions{
		Method:   http.MethodPost,
		Path:     path,
		FormData: form,
		Headers:  headers,
	})
}

func postJSONWithHeaders(c *e2etesting.HTTPClient, path string, body any, headers map[string]string) (*e2etesting.Response, error) {
	return c.Request(&e2etesting.RequestOptions{
		Method:  http.MethodPost,
		Path:    path,
		Body:    body,
		Headers: headers,
	})
}

func TestCSRFLegacyMechanism(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)

	t.Run("GET /auth/login sets _csrf cookie and renders real token in Inertia props", func(t *testing.T) {
		TagTest(t, "GET", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		ck := findSetCookie(resp, csrfCookieName)
		require.NotNil(t, ck, "Set-Cookie: _csrf must be present in response")
		assert.Len(t, ck.Value, csrfTokenLen, "_csrf token should be %d chars", csrfTokenLen)
		assert.Equal(t, "/", ck.Path)
		assert.False(t, ck.HttpOnly, "test config sets CookieHTTPOnly=false; prod enforcement sets it true")
		assert.False(t, ck.Secure, "test config sets CookieSecure=false; prod enforcement sets it true")
		assert.Equal(t, http.SameSiteLaxMode, ck.SameSite, "test config uses lax; prod enforcement uses strict")

		inertiaToken := extractInertiaCSRFToken(t, resp.Body)
		assert.Equal(t, ck.Value, inertiaToken,
			"Inertia props.csrfToken should equal the _csrf cookie value")
		assert.NotEqual(t, csrfFetchSiteDummy, inertiaToken,
			"legacy path should use a real token, not the fetch-metadata dummy")
	})

	t.Run("POST without cookie or header returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := client.PostForm("/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, strings.ToLower(resp.GetString()), "missing csrf token")
	})

	t.Run("POST with cookie but no header returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, err := client.Get("/auth/login")
		require.NoError(t, err)
		require.NotNil(t, getCSRFCookie(t, client), "GET should seed _csrf cookie")

		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"X-CSRF-Token": "   "})
		require.NoError(t, err)
		assert.Contains(t, []int{http.StatusBadRequest, http.StatusForbidden}, resp.StatusCode,
			"whitespace-only csrf header should be rejected")
	})

	t.Run("POST with cookie and mismatched header returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, err := client.Get("/auth/login")
		require.NoError(t, err)

		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"X-CSRF-Token": "this-is-the-wrong-token-value"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("POST with cookie and matching header is accepted", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, err := client.Get("/auth/login")
		require.NoError(t, err)
		ck := getCSRFCookie(t, client)
		require.NotNil(t, ck)

		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"X-CSRF-Token": ck.Value})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})

	t.Run("csrf token does not rotate on login or across multiple safe requests", func(t *testing.T) {
		TagTest(t, "GET", "/auth/login", e2etesting.CategoryIntegration, e2etesting.ValueMedium)
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()

		_, err := client.Get("/auth/login")
		require.NoError(t, err)
		tokBefore := getCSRFCookie(t, client).Value

		_, err = client.Get("/auth/login")
		require.NoError(t, err)
		assert.Equal(t, tokBefore, getCSRFCookie(t, client).Value,
			"second safe GET must reuse same _csrf token")

		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"X-CSRF-Token": tokBefore})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)

		assert.Equal(t, tokBefore, getCSRFCookie(t, client).Value,
			"echo csrf middleware does not rotate token on login — if we add rotation this flips")

		_, err = client.Get("/")
		require.NoError(t, err)
		assert.Equal(t, tokBefore, getCSRFCookie(t, client).Value)
	})
}

func TestCSRFFetchMetadataMechanism(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)

	t.Run("GET with Sec-Fetch-Site same-origin skips cookie and uses dummy token in Inertia props", func(t *testing.T) {
		TagTest(t, "GET", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		client := app.HTTPClient.WithCookieJar()
		resp, err := getWithHeaders(client, "/auth/login", map[string]string{
			"Sec-Fetch-Site": "same-origin",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		assert.Nil(t, findSetCookie(resp, csrfCookieName),
			"fast-path must NOT emit Set-Cookie: _csrf")
		assert.Nil(t, getCSRFCookie(t, client),
			"no _csrf cookie should have landed in jar from fast-path response")

		inertiaToken := extractInertiaCSRFToken(t, resp.Body)
		assert.Equal(t, csrfFetchSiteDummy, inertiaToken,
			"fetch-metadata fast-path stores dummy constant in echo context, which inertiacsrf mirrors into Inertia props")
	})

	t.Run("GET with Sec-Fetch-Site none also fast-paths (direct navigation)", func(t *testing.T) {
		TagTest(t, "GET", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		client := app.HTTPClient.WithCookieJar()
		resp, err := getWithHeaders(client, "/auth/login", map[string]string{
			"Sec-Fetch-Site": "none",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Nil(t, findSetCookie(resp, csrfCookieName))
		assert.Equal(t, csrfFetchSiteDummy, extractInertiaCSRFToken(t, resp.Body))
	})

	t.Run("GET with Sec-Fetch-Site cross-site still fast-paths because GET is safe", func(t *testing.T) {
		TagTest(t, "GET", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		client := app.HTTPClient.WithCookieJar()
		resp, err := getWithHeaders(client, "/auth/login", map[string]string{
			"Sec-Fetch-Site": "cross-site",
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Nil(t, findSetCookie(resp, csrfCookieName))
	})

	t.Run("POST with Sec-Fetch-Site same-origin accepted without any CSRF token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"Sec-Fetch-Site": "same-origin"})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})

	t.Run("POST with Sec-Fetch-Site none also accepted without CSRF token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"Sec-Fetch-Site": "none"})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})

	t.Run("POST with Sec-Fetch-Site same-origin ignores a bogus X-CSRF-Token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{
			"Sec-Fetch-Site": "same-origin",
			"X-CSRF-Token":   "totally-bogus-header-value-ignored-on-fast-path",
		})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})

	t.Run("POST with Sec-Fetch-Site cross-site returns immediate 403", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		client := app.HTTPClient.WithoutRedirects()
		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"Sec-Fetch-Site": "cross-site"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		assert.Contains(t, strings.ToLower(resp.GetString()), "cross-site",
			"echo returns an explicit 'cross-site request blocked by CSRF' body")
	})

	t.Run("POST with Sec-Fetch-Site same-site falls through to legacy token check", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		resp, err := postFormWithHeaders(client, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{"Sec-Fetch-Site": "same-site"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		client2 := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, err = client2.Get("/auth/login")
		require.NoError(t, err)
		tok := getCSRFCookie(t, client2).Value

		resp, err = postFormWithHeaders(client2, "/auth/login", url.Values{
			"username": {user.Username},
			"password": {user.Password},
		}, map[string]string{
			"Sec-Fetch-Site": "same-site",
			"X-CSRF-Token":   tok,
		})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})
}

func TestCSRFAPIHybrid(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "csrfapihybrid",
		Email:    "csrfapihybrid@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	t.Run("unauthenticated API POST (no Authorization) skips CSRF", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/api-keys", map[string]any{"name": "x"})
		require.NoError(t, err)
		assert.NotContains(t, strings.ToLower(resp.GetString()), "csrf")
		assert.GreaterOrEqual(t, resp.StatusCode, 400)
		assert.Less(t, resp.StatusCode, 500)
	})

	t.Run("JWT-authenticated API POST skips CSRF", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", map[string]string{
			"username": user.Username,
			"password": user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, loginResp.StatusCode, "API login body: %s", loginResp.GetString())

		var loginData struct {
			Data struct {
				AccessToken string `json:"access_token"`
			} `json:"data"`
		}
		require.NoError(t, loginResp.GetJSON(&loginData))
		require.NotEmpty(t, loginData.Data.AccessToken)

		resp, err := postJSONWithHeaders(app.HTTPClient, "/api/v1/api-keys",
			map[string]any{"name": "jwt-created-key"},
			map[string]string{"Authorization": "Bearer " + loginData.Data.AccessToken},
		)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
		assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
		assert.NotContains(t, strings.ToLower(resp.GetString()), "csrf")
	})

	t.Run("session-authenticated API POST without CSRF header returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
		sessionCookie := app.SessionHelper.GetSessionCookie(mustLoginResp(t, app, user))
		require.NotNil(t, sessionCookie)

		barren := app.SessionHelper.WithSessionCookie(sessionCookie)

		resp, err := barren.Post("/api/v1/api-keys", map[string]any{"name": "no-csrf"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
			"session-auth API POST without X-CSRF-Token should be rejected with 400 missing")
		assert.Contains(t, strings.ToLower(resp.GetString()), "csrf")

		resp2, err := sessionClient.Post("/api/v1/api-keys", map[string]any{"name": "with-csrf"})
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp2.StatusCode,
			"session-auth API POST WITH correct X-CSRF-Token should succeed; body=%s", resp2.GetString())
	})

	t.Run("session-authenticated API POST with Sec-Fetch-Site same-origin bypasses CSRF", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		sessionCookie := app.SessionHelper.GetSessionCookie(mustLoginResp(t, app, user))
		require.NotNil(t, sessionCookie)
		barren := app.SessionHelper.WithSessionCookie(sessionCookie)

		resp, err := postJSONWithHeaders(barren, "/api/v1/api-keys",
			map[string]any{"name": "fast-path-key"},
			map[string]string{"Sec-Fetch-Site": "same-origin"},
		)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode,
			"Sec-Fetch-Site fast-path should pass CSRF even without _csrf cookie/header; body=%s", resp.GetString())
	})

	t.Run("session-authenticated API POST with Sec-Fetch-Site cross-site returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/api-keys", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := postJSONWithHeaders(sessionClient, "/api/v1/api-keys",
			map[string]any{"name": "blocked"},
			map[string]string{"Sec-Fetch-Site": "cross-site"},
		)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		assert.Contains(t, strings.ToLower(resp.GetString()), "cross-site")
	})
}

func mustLoginResp(t *testing.T, app *TestApp, user *e2etesting.TestUser) *e2etesting.Response {
	t.Helper()
	resp, err := app.AuthHelper.Login(user.Username, user.Password)
	require.NoError(t, err)
	app.AuthHelper.AssertLoginSuccess(t, resp)
	return resp
}
