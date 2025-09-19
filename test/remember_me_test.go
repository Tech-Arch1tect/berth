package test

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/services/auth"
)

func TestRememberMeBasicFunctionality(t *testing.T) {
	app := NewTestApp(t, &TestOptions{})
	defer app.Cleanup()

	user, err := app.CreateTestUser("rememberuser", "remember@example.com", "Password123!")
	require.NoError(t, err)

	t.Run("login with remember me enabled", func(t *testing.T) {
		loginData := url.Values{
			"username":    {"rememberuser"},
			"password":    {"Password123!"},
			"remember_me": {"true"},
		}

		resp, err := app.PostNoRedirect("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Should redirect to dashboard after successful login
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/", resp.Header.Get("Location"))

		// Should create remember me token in database
		tokens, err := app.GetActiveRememberMeTokens(user.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, tokens, "Remember me token should be created")

		token := tokens[0]
		assert.Equal(t, user.ID, token.UserID)
		assert.False(t, token.Used)
		assert.True(t, token.ExpiresAt.After(time.Now()))

		// Should set remember me cookie
		rememberCookie := app.GetRememberMeCookie(resp)
		assert.NotNil(t, rememberCookie, "Remember me cookie should be set")
	})

	t.Run("login without remember me", func(t *testing.T) {
		app.db.Where("user_id = ?", user.ID).Delete(&auth.RememberMeToken{})

		loginData := url.Values{
			"username": {"rememberuser"},
			"password": {"Password123!"},
		}

		resp, err := app.PostNoRedirect("/auth/login", loginData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Should redirect to dashboard after successful login
		assert.Equal(t, http.StatusFound, resp.StatusCode)
		assert.Equal(t, "/", resp.Header.Get("Location"))

		// Should NOT create remember me token in database
		tokens, err := app.GetActiveRememberMeTokens(user.ID)
		require.NoError(t, err)
		assert.Empty(t, tokens, "No remember me tokens should be created when not requested")

		// Should NOT set remember me cookie
		rememberCookie := app.GetRememberMeCookie(resp)
		assert.Nil(t, rememberCookie, "Remember me cookie should not be set when not requested")
	})
}

func TestRememberMeTokenManagement(t *testing.T) {
	app := NewTestApp(t, &TestOptions{})
	defer app.Cleanup()

	user, err := app.CreateTestUser("tokenuser", "token@example.com", "Password123!")
	require.NoError(t, err)

	t.Run("token expiry", func(t *testing.T) {
		token := "test-token-123"
		expiresAt := time.Now().Add(1 * time.Hour)

		err := app.CreateRememberMeToken(user.ID, token, expiresAt)
		require.NoError(t, err)

		tokens, err := app.GetActiveRememberMeTokens(user.ID)
		require.NoError(t, err)
		assert.Len(t, tokens, 1)

		err = app.db.Model(&auth.RememberMeToken{}).
			Where("user_id = ?", user.ID).
			Update("expires_at", time.Now().Add(-1*time.Hour)).Error
		require.NoError(t, err)

		tokens, err = app.GetActiveRememberMeTokens(user.ID)
		require.NoError(t, err)
		assert.Empty(t, tokens, "Expired tokens should not be returned")
	})
}
