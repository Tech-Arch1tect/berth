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

	user, err := app.CreateTestUser("testuser", "test@example.com", "Password123!")
	require.NoError(t, err)
	require.NotNil(t, user)

	t.Run("successful login", func(t *testing.T) {
		loginData := url.Values{
			"username": {"testuser"},
			"password": {"Password123!"},
		}

		resp, err := app.Post("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;authenticated&#34;:true`)
		assert.Contains(t, body, `&#34;username&#34;:&#34;testuser&#34;`)

		cookies := resp.Cookies()
		found := false
		for _, cookie := range cookies {
			if cookie.Name == "brx-session" {
				found = true
				break
			}
		}
		assert.True(t, found, "session cookie should be set")
	})

	/*
		// todo
		t.Run("login with remember me", func(t *testing.T) {

			})
	*/
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

		resp, err = app.Post("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := app.ReadBody(resp)
		require.NoError(t, err)
		assert.Contains(t, body, `&#34;authenticated&#34;:true`)
		assert.Contains(t, body, `&#34;username&#34;:&#34;flowuser&#34;`)
	})
}
