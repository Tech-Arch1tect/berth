package test

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoginHTTP(t *testing.T) {
	app := NewTestApp(t, &TestOptions{})
	defer app.Cleanup()

	user, err := app.CreateTestUser("testuser", "test@example.com", "Password123!")
	require.NoError(t, err)
	require.NotNil(t, user)

	t.Run("successful login", func(t *testing.T) {
		loginData := url.Values{
			"username": {"testuser"},
			"password": {"Password123!"},
		}

		resp, err := app.PostNoRedirect("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Successful login should redirect (302) to dashboard
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/", resp.Header.Get("Location"))

		cookies := resp.Cookies()
		found := false
		for _, cookie := range cookies {
			if cookie.Name == "berth" {
				found = true
				break
			}
		}
		assert.True(t, found, "session cookie should be set")
	})

	t.Run("login with remember me", func(t *testing.T) {
		loginData := url.Values{
			"username":    {"testuser"},
			"password":    {"Password123!"},
			"remember_me": {"true"},
		}

		resp, err := app.PostNoRedirect("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Successful login should redirect (302) to dashboard
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/", resp.Header.Get("Location"))

		// Check for session cookie
		cookies := resp.Cookies()
		sessionFound := false
		rememberFound := false

		for _, cookie := range cookies {
			t.Logf("Cookie found: %s = %s (domain: %s, path: %s, secure: %v, httponly: %v)",
				cookie.Name, cookie.Value, cookie.Domain, cookie.Path, cookie.Secure, cookie.HttpOnly)
			if cookie.Name == "berth" {
				sessionFound = true
			}
			if cookie.Name == "remember_me" {
				rememberFound = true
				t.Logf("Remember me cookie found: %s", cookie.Value)
			}
		}

		assert.True(t, sessionFound, "session cookie should be set")

		assert.True(t, rememberFound, "Remember me cookie should be set when requested")

		// Check database for remember me token
		tokens, err := app.GetActiveRememberMeTokens(user.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, tokens, "Remember me token should be created in database")
	})
	t.Run("invalid credentials", func(t *testing.T) {
		loginData := url.Values{
			"username": {"testuser"},
			"password": {"wrongpassword"},
		}

		resp, err := app.PostWithNewClient("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;component&#34;:&#34;Auth/Login&#34;`)
		assert.Contains(t, body, `&#34;authenticated&#34;:false`)
	})

	t.Run("missing username", func(t *testing.T) {
		loginData := url.Values{
			"password": {"Password123!"},
		}

		resp, err := app.PostWithNewClient("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;component&#34;:&#34;Auth/Login&#34;`)
		assert.Contains(t, body, `&#34;authenticated&#34;:false`)
	})

	t.Run("missing password", func(t *testing.T) {
		loginData := url.Values{
			"username": {"testuser"},
		}

		resp, err := app.PostWithNewClient("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;component&#34;:&#34;Auth/Login&#34;`)
		assert.Contains(t, body, `&#34;authenticated&#34;:false`)
	})

	t.Run("nonexistent user", func(t *testing.T) {
		loginData := url.Values{
			"username": {"nonexistent"},
			"password": {"Password123!"},
		}

		resp, err := app.PostWithNewClient("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;component&#34;:&#34;Auth/Login&#34;`)
		assert.Contains(t, body, `&#34;authenticated&#34;:false`)
	})
}

func TestLoginFlow(t *testing.T) {
	app := NewTestApp(t, &TestOptions{})
	defer app.Cleanup()

	_, err := app.CreateTestUser("flowuser", "flow@example.com", "Password123!")
	require.NoError(t, err)

	t.Run("complete login flow", func(t *testing.T) {
		resp, err := app.Get("/auth/login")
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		loginData := url.Values{
			"username": {"flowuser"},
			"password": {"Password123!"},
		}

		resp, err = app.PostNoRedirect("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Successful login should redirect (302) to dashboard
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/", resp.Header.Get("Location"))

		cookies := resp.Cookies()
		found := false
		for _, cookie := range cookies {
			if cookie.Name == "berth" {
				found = true
				break
			}
		}
		assert.True(t, found, "session cookie should be set")
	})
}
