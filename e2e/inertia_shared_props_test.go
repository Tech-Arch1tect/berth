package e2e

import (
	"encoding/json"
	"html"
	"net/http"
	"regexp"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func extractInertiaProps(t *testing.T, body []byte) map[string]any {
	t.Helper()
	re := regexp.MustCompile(`data-page="([^"]*)"`)
	m := re.FindSubmatch(body)
	require.NotNil(t, m, "data-page attribute not found in HTML response")
	decoded := html.UnescapeString(string(m[1]))
	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal([]byte(decoded), &page),
		"failed to parse data-page JSON: %s", decoded)
	require.NotNil(t, page.Props, "props should not be nil")
	return page.Props
}

func extractInertiaJSON(t *testing.T, client *e2etesting.HTTPClient, path string) map[string]any {
	t.Helper()
	resp, err := client.Request(&e2etesting.RequestOptions{
		Method: http.MethodGet,
		Path:   path,
		Headers: map[string]string{
			"X-Inertia":         "true",
			"X-Inertia-Version": "",
		},
	})
	require.NoError(t, err)
	resp.AssertStatus(t, http.StatusOK)
	require.Contains(t, resp.Header.Get("Content-Type"), "application/json",
		"X-Inertia request should return JSON")

	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal(resp.Body, &page),
		"failed to parse Inertia JSON: %s", string(resp.Body))
	require.NotNil(t, page.Props, "props should not be nil")
	return page.Props
}

func TestInertiaSharedPropsUnauthenticated(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("login page has authenticated=false and no user props", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)

		authenticated, ok := props["authenticated"]
		require.True(t, ok, "authenticated prop should be present")
		assert.Equal(t, false, authenticated, "unauthenticated user should have authenticated=false")

		assert.Nil(t, props["userID"], "userID should not be present for unauthenticated user")
		assert.Nil(t, props["currentUser"], "currentUser should not be present for unauthenticated user")
	})

	t.Run("csrfToken is present on unauthenticated page", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		csrfToken, ok := props["csrfToken"].(string)
		assert.True(t, ok, "csrfToken should be a string")
		assert.NotEmpty(t, csrfToken, "csrfToken should not be empty")
	})

	t.Run("flashMessages absent when none set", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		fm := props["flashMessages"]
		if fm != nil {
			msgs, ok := fm.([]any)
			assert.True(t, ok, "flashMessages should be an array")
			assert.Empty(t, msgs, "flashMessages should be empty when none set")
		}
	})
}

func TestInertiaSharedPropsAuthenticated(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "inertiauser",
		Email:    "inertia@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("authenticated user has auth props with user object", func(t *testing.T) {
		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := client.Get("/")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)

		authenticated, ok := props["authenticated"]
		require.True(t, ok, "authenticated prop should be present")
		assert.Equal(t, true, authenticated)

		userID, ok := props["userID"]
		require.True(t, ok, "userID prop should be present for authenticated user")
		assert.Equal(t, float64(user.ID), userID, "userID should match the logged-in user")

		currentUser, ok := props["currentUser"].(map[string]any)
		require.True(t, ok, "currentUser should be a map")
		assert.Equal(t, user.Username, currentUser["username"])
		assert.Equal(t, user.Email, currentUser["email"])
		assert.Nil(t, currentUser["password"], "password must not be in currentUser props")

		cuID, ok := currentUser["id"]
		require.True(t, ok, "currentUser should have an id")
		assert.Equal(t, float64(user.ID), cuID)
	})

	t.Run("admin user currentUser includes roles with is_admin=true", func(t *testing.T) {
		adminUser := &e2etesting.TestUser{
			Username: "inertiaadmin",
			Email:    "inertia-admin@example.com",
			Password: "password123",
		}
		app.CreateAdminTestUser(t, adminUser)

		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, adminUser.Username, adminUser.Password)
		resp, err := client.Get("/")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		currentUser, ok := props["currentUser"].(map[string]any)
		require.True(t, ok, "currentUser should be a map")

		roles, ok := currentUser["roles"].([]any)
		require.True(t, ok, "currentUser.roles should be an array")
		require.NotEmpty(t, roles, "admin user should have at least one role")

		foundAdmin := false
		for _, r := range roles {
			role, ok := r.(map[string]any)
			require.True(t, ok)
			if role["name"] == "admin" {
				assert.Equal(t, true, role["is_admin"], "admin role should have is_admin=true")
				foundAdmin = true
			}
		}
		assert.True(t, foundAdmin, "admin user should have an 'admin' role in currentUser.roles")
	})

	t.Run("non-admin user has empty roles", func(t *testing.T) {
		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
		resp, err := client.Get("/")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		currentUser, ok := props["currentUser"].(map[string]any)
		require.True(t, ok, "currentUser should be a map")

		roles := currentUser["roles"]
		if roles != nil {
			rolesArr, ok := roles.([]any)
			assert.True(t, ok, "roles should be an array if present")
			assert.Empty(t, rolesArr, "non-admin user should have no roles")
		}
	})
}

func TestInertiaSharedPropsFlashMessages(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "flashuser",
		Email:    "flash@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("login success sets flash messages on redirected page", func(t *testing.T) {
		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := client.Get("/")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		fm, ok := props["flashMessages"].([]any)
		require.True(t, ok, "flashMessages should be an array after login redirect")
		require.Len(t, fm, 2, "login should set exactly two flash messages")

		msg0, ok := fm[0].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Login successful!", msg0["message"])
		assert.Equal(t, "success", msg0["type"])

		msg1, ok := fm[1].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Welcome back! Your last login was recorded.", msg1["message"])
		assert.Equal(t, "info", msg1["type"])
	})

	t.Run("flash messages consumed after first read", func(t *testing.T) {
		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := client.Get("/")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)
		props := extractInertiaProps(t, resp.Body)
		fm, ok := props["flashMessages"].([]any)
		require.True(t, ok, "flashMessages should be present on first load")
		require.NotEmpty(t, fm, "flashMessages should not be empty on first load")

		resp2, err := client.Get("/")
		require.NoError(t, err)
		resp2.AssertStatus(t, http.StatusOK)
		props2 := extractInertiaProps(t, resp2.Body)
		fm2 := props2["flashMessages"]
		if fm2 != nil {
			msgs, ok := fm2.([]any)
			assert.True(t, ok)
			assert.Empty(t, msgs, "flashMessages should be empty on second load (consumed)")
		}
	})

	t.Run("failed login sets error flash on login page", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()

		_, err := client.Get("/auth/login")
		require.NoError(t, err)

		resp, err := client.PostForm("/auth/login", map[string][]string{
			"username": {"flashuser"},
			"password": {"wrongpassword"},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		resp2, err := client.Get("/auth/login")
		require.NoError(t, err)
		resp2.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp2.Body)
		fm, ok := props["flashMessages"].([]any)
		require.True(t, ok, "flashMessages should be present after failed login")
		require.NotEmpty(t, fm, "should have at least one error flash")

		foundError := false
		for _, f := range fm {
			msg, ok := f.(map[string]any)
			require.True(t, ok)
			if msg["type"] == "error" {
				assert.Equal(t, "Invalid credentials", msg["message"])
				foundError = true
			}
		}
		assert.True(t, foundError, "should have an error flash with 'Invalid credentials'")
	})
}

func TestInertiaSharedPropsCSRFMechanisms(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("legacy mechanism shows real token in csrfToken prop", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/login")
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		csrfToken, ok := props["csrfToken"].(string)
		require.True(t, ok, "csrfToken should be a string")
		assert.NotEmpty(t, csrfToken)
		assert.NotEqual(t, csrfFetchSiteDummy, csrfToken,
			"without Sec-Fetch-Site, should get a real token, not the dummy")
		assert.Len(t, csrfToken, csrfTokenLen,
			"legacy CSRF token should be %d chars", csrfTokenLen)
	})

	t.Run("fetch metadata mechanism shows dummy token in csrfToken prop", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Request(&e2etesting.RequestOptions{
			Method: http.MethodGet,
			Path:   "/auth/login",
			Headers: map[string]string{
				"Sec-Fetch-Site": "same-origin",
			},
		})
		require.NoError(t, err)
		resp.AssertStatus(t, http.StatusOK)

		props := extractInertiaProps(t, resp.Body)
		csrfToken, ok := props["csrfToken"].(string)
		require.True(t, ok, "csrfToken should be a string")
		assert.Equal(t, csrfFetchSiteDummy, csrfToken,
			"with Sec-Fetch-Site: same-origin, csrfToken should be the dummy constant")

		csrfCookie := findSetCookie(resp, "_csrf")
		assert.Nil(t, csrfCookie,
			"Sec-Fetch-Site fast-path should not emit a _csrf cookie")
	})
}
