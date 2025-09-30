package e2e

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestUserLogin(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("successful login", func(t *testing.T) {

		user := &e2etesting.TestUser{
			Username: "loginuser1",
			Email:    "loginuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)

		app.AuthHelper.AssertLoginSuccess(t, resp)

		sessionCookie := app.SessionHelper.AssertSessionCookiePresent(t, resp)
		assert.NotEmpty(t, sessionCookie.Value)

		app.SessionHelper.AssertSessionExists(t, user.ID)
	})

	t.Run("invalid credentials", func(t *testing.T) {

		user := &e2etesting.TestUser{
			Username: "loginuser2",
			Email:    "loginuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.AuthHelper.Login(user.Username, "wrongpassword")
		require.NoError(t, err)

		app.AuthHelper.AssertLoginFailed(t, resp)

		app.SessionHelper.AssertSessionNotExists(t, user.ID)
	})

	t.Run("nonexistent user", func(t *testing.T) {

		resp, err := app.AuthHelper.Login("nonexistent", "password")
		require.NoError(t, err)

		app.AuthHelper.AssertLoginFailed(t, resp)
	})
}

func TestUserLogout(t *testing.T) {
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)
	authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	resp, err := authenticatedClient.Get("/")
	require.NoError(t, err)
	assert.Equal(t, 200, resp.StatusCode)

	resp, err = authenticatedClient.PostForm("/auth/logout", nil)
	require.NoError(t, err)

	resp.AssertRedirect(t, "/auth/login")

	app.SessionHelper.AssertSessionNotExists(t, user.ID)
}

func TestRememberMe(t *testing.T) {
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)

	t.Run("remember me login creates token", func(t *testing.T) {

		resp, err := app.AuthHelper.LoginWithRememberMe(user.Username, user.Password)
		require.NoError(t, err)

		app.AuthHelper.AssertLoginSuccess(t, resp)

		var rememberMeCookie *http.Cookie
		for _, cookie := range resp.Cookies() {
			if cookie.Name == "remember_me" {
				rememberMeCookie = cookie
				break
			}
		}
		require.NotNil(t, rememberMeCookie, "remember me cookie should be present")
		assert.NotEmpty(t, rememberMeCookie.Value)

		var count int64
		err = app.AuthHelper.DB.Table("remember_me_tokens").
			Where("user_id = ? AND used = ?", user.ID, false).Count(&count).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("remember me restores session after expiry", func(t *testing.T) {
		resp, err := app.AuthHelper.LoginWithRememberMe(user.Username, user.Password)
		require.NoError(t, err)

		app.AuthHelper.AssertLoginSuccess(t, resp)

		var rememberCookie *http.Cookie
		for _, cookie := range resp.Cookies() {
			if cookie.Name == "remember_me" {
				rememberCookie = cookie
				break
			}
		}
		require.NotNil(t, rememberCookie, "remember me cookie should be present")
		require.NotEmpty(t, rememberCookie.Value)

		require.NoError(t, app.SessionHelper.CleanSessionTables(), "failed to clear sessions to simulate expiry")

		client := app.HTTPClient.WithCookieJar()
		u, err := url.Parse(app.HTTPClient.BaseURL)
		require.NoError(t, err)
		client.Client.Jar.SetCookies(u, []*http.Cookie{rememberCookie})

		resp, err = client.Get("/")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		app.SessionHelper.AssertSessionExists(t, user.ID)
	})
}

func TestPasswordReset(t *testing.T) {
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)

	t.Run("password reset flow", func(t *testing.T) {

		resp, err := app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)

		resp.AssertRedirect(t, "/auth/login")

		resetToken := app.AuthHelper.GetPasswordResetToken(t, user.Email)
		assert.NotEmpty(t, resetToken)

		newPassword := "newpassword123"
		resp, err = app.AuthHelper.ResetPassword(resetToken, newPassword)
		require.NoError(t, err)

		resp.AssertRedirect(t, "/auth/login")

		resp, err = app.AuthHelper.Login(user.Username, newPassword)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)

		resp, err = app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginFailed(t, resp)
	})

	t.Run("invalid token", func(t *testing.T) {

		resp, err := app.AuthHelper.ResetPassword("invalid-token", "newpassword")
		require.NoError(t, err)

		resp.AssertRedirect(t, "/auth/password-reset")
	})
}

func TestProtectedRoutes(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("unauthenticated access redirects to login", func(t *testing.T) {

		resp, err := app.HTTPClient.WithoutRedirects().Get("/")
		require.NoError(t, err)

		app.SessionHelper.AssertAuthenticationRequired(t, resp)
	})

	t.Run("authenticated access works", func(t *testing.T) {

		user := app.CreateVerifiedTestUser(t)
		authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := authenticatedClient.Get("/")
		require.NoError(t, err)

		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestSessionManagement(t *testing.T) {
	app := SetupTestApp(t)

	user := app.CreateVerifiedTestUser(t)
	authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("view sessions page", func(t *testing.T) {
		resp, err := authenticatedClient.Get("/sessions")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("revoke all other sessions", func(t *testing.T) {

		app.SessionHelper.CreateTestSession(t, user.ID, "another-session-token")

		app.SessionHelper.AssertSessionCount(t, user.ID, 2)

		resp, err := authenticatedClient.PostForm("/sessions/revoke-all-others", nil)
		require.NoError(t, err)

		resp.AssertRedirect(t, "/sessions")

		app.SessionHelper.AssertSessionCount(t, user.ID, 1)
	})
}
