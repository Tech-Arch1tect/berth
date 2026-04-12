package e2e

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/config"
)

func extractRememberMeCookie(resp *e2etesting.Response) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == "remember_me" {
			return c
		}
	}
	return nil
}

func getRememberMeTokenCount(app *TestApp, userID uint) int64 {
	var count int64
	app.DB.Table("remember_me_tokens").
		Where("user_id = ? AND used = ? AND deleted_at IS NULL", userID, false).
		Count(&count)
	return count
}

func restoreSessionWithCookie(t *testing.T, app *TestApp, cookie *http.Cookie) *e2etesting.Response {
	t.Helper()
	client := app.HTTPClient.WithCookieJar()
	u, err := url.Parse(app.HTTPClient.BaseURL)
	require.NoError(t, err)
	client.Client.Jar.SetCookies(u, []*http.Cookie{cookie})

	resp, err := client.Get("/")
	require.NoError(t, err)
	return resp
}

func loginWithRememberMeClient(t *testing.T, app *TestApp, username, password string) (*e2etesting.HTTPClient, *http.Cookie) {
	t.Helper()
	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	_, err := client.Get("/auth/login")
	require.NoError(t, err)

	resp, err := client.PostForm("/auth/login", url.Values{
		"username":    {username},
		"password":    {password},
		"remember_me": {"true"},
	})
	require.NoError(t, err)
	app.AuthHelper.AssertLoginSuccess(t, resp)

	cookie := extractRememberMeCookie(resp)
	require.NotNil(t, cookie, "remember_me cookie should be set after login")
	require.NotEmpty(t, cookie.Value)
	return client, cookie
}

func TestRememberMeTokenRotation(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(cfg *config.Config) {
		cfg.Auth.RememberMeRotateOnUse = true
	})
	user := app.CreateVerifiedTestUser(t)

	t.Run("token rotates on session restore", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategoryIntegration, e2etesting.ValueHigh)

		_, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)
		originalToken := cookie.Value

		require.NoError(t, app.SessionHelper.CleanSessionTables())

		client := app.HTTPClient.WithCookieJar()
		u, err := url.Parse(app.HTTPClient.BaseURL)
		require.NoError(t, err)
		client.Client.Jar.SetCookies(u, []*http.Cookie{cookie})

		resp, err := client.Get("/")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		app.SessionHelper.AssertSessionExists(t, user.ID)

		newCookie := extractRememberMeCookie(resp)
		require.NotNil(t, newCookie, "rotated remember_me cookie should be set")
		assert.NotEqual(t, originalToken, newCookie.Value, "token should have been rotated")
		assert.NotEmpty(t, newCookie.Value)
	})

	t.Run("old token rejected after rotation", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		_, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)
		oldToken := cookie.Value

		require.NoError(t, app.SessionHelper.CleanSessionTables())

		client := app.HTTPClient.WithCookieJar()
		u, err := url.Parse(app.HTTPClient.BaseURL)
		require.NoError(t, err)
		client.Client.Jar.SetCookies(u, []*http.Cookie{cookie})

		resp, err := client.Get("/")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		app.SessionHelper.AssertSessionExists(t, user.ID)

		require.NoError(t, app.SessionHelper.CleanSessionTables())

		oldCookie := &http.Cookie{
			Name:  "remember_me",
			Value: oldToken,
		}
		resp = restoreSessionWithCookie(t, app, oldCookie)
		app.SessionHelper.AssertSessionNotExists(t, user.ID)
	})
}

func TestRememberMeNoRotation(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(cfg *config.Config) {
		cfg.Auth.RememberMeRotateOnUse = false
	})
	user := app.CreateVerifiedTestUser(t)

	t.Run("token reusable when rotation disabled", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategoryIntegration, e2etesting.ValueHigh)

		_, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)

		require.NoError(t, app.SessionHelper.CleanSessionTables())
		resp := restoreSessionWithCookie(t, app, cookie)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		app.SessionHelper.AssertSessionExists(t, user.ID)

		newCookie := extractRememberMeCookie(resp)
		assert.Nil(t, newCookie, "no rotated cookie when rotation disabled")

		require.NoError(t, app.SessionHelper.CleanSessionTables())
		resp = restoreSessionWithCookie(t, app, cookie)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		app.SessionHelper.AssertSessionExists(t, user.ID)
	})
}

func TestRememberMeTokenExpiry(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := app.CreateVerifiedTestUser(t)

	t.Run("expired token does not restore session", func(t *testing.T) {
		TagTest(t, "GET", "/", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		_, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)

		err := app.DB.Table("remember_me_tokens").
			Where("user_id = ?", user.ID).
			Update("expires_at", time.Now().Add(-1*time.Hour)).Error
		require.NoError(t, err)

		require.NoError(t, app.SessionHelper.CleanSessionTables())

		restoreSessionWithCookie(t, app, cookie)
		app.SessionHelper.AssertSessionNotExists(t, user.ID)
	})
}

func TestRememberMeLogoutInvalidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := app.CreateVerifiedTestUser(t)

	t.Run("logout invalidates remember me tokens", func(t *testing.T) {
		TagTest(t, "POST", "/auth/logout", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		client, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)

		assert.Equal(t, int64(1), getRememberMeTokenCount(app, user.ID))

		_, err := client.PostForm("/auth/logout", url.Values{})
		require.NoError(t, err)

		assert.Equal(t, int64(0), getRememberMeTokenCount(app, user.ID),
			"all remember-me tokens should be deleted after logout")

		require.NoError(t, app.SessionHelper.CleanSessionTables())
		restoreSessionWithCookie(t, app, cookie)
		app.SessionHelper.AssertSessionNotExists(t, user.ID)
	})
}

func TestRememberMePasswordResetRevocation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("password reset invalidates remember me tokens", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		user := app.CreateVerifiedTestUser(t)

		_, cookie := loginWithRememberMeClient(t, app, user.Username, user.Password)

		assert.Equal(t, int64(1), getRememberMeTokenCount(app, user.ID))

		_, err := app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)

		require.True(t, app.Mail.Len() > 0, "password reset email should be sent")
		resetMails := app.Mail.ByTemplate("password_reset")
		require.NotEmpty(t, resetMails, "should have password_reset email")
		resetURL, ok := resetMails[len(resetMails)-1].Data["ResetURL"].(string)
		require.True(t, ok, "ResetURL should be a string in email data")
		idx := strings.Index(resetURL, "token=")
		require.NotEqual(t, -1, idx, "ResetURL should contain token= parameter")
		resetToken := resetURL[idx+len("token="):]

		newPassword := "newpassword123"
		_, err = app.AuthHelper.ResetPassword(resetToken, newPassword)
		require.NoError(t, err)

		assert.Equal(t, int64(0), getRememberMeTokenCount(app, user.ID),
			"remember-me tokens should be deleted after password reset")

		require.NoError(t, app.SessionHelper.CleanSessionTables())
		restoreSessionWithCookie(t, app, cookie)
		app.SessionHelper.AssertSessionNotExists(t, user.ID)

		resp, err := app.AuthHelper.Login(user.Username, newPassword)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})
}

func TestRememberMeDisabled(t *testing.T) {
	t.Parallel()
	app := SetupTestAppWithConfig(t, func(cfg *config.Config) {
		cfg.Auth.RememberMeEnabled = false
	})
	user := app.CreateVerifiedTestUser(t)

	t.Run("no cookie when feature disabled", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, err := client.Get("/auth/login")
		require.NoError(t, err)

		resp, err := client.PostForm("/auth/login", url.Values{
			"username":    {user.Username},
			"password":    {user.Password},
			"remember_me": {"true"},
		})
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)

		cookie := extractRememberMeCookie(resp)
		assert.Nil(t, cookie, "no remember_me cookie when feature is disabled")

		assert.Equal(t, int64(0), getRememberMeTokenCount(app, user.ID),
			"no tokens should be created when feature is disabled")
	})
}

func TestRememberMeNewLoginReplacesOldToken(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := app.CreateVerifiedTestUser(t)

	t.Run("second login replaces first token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/login", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

		_, firstCookie := loginWithRememberMeClient(t, app, user.Username, user.Password)
		assert.Equal(t, int64(1), getRememberMeTokenCount(app, user.ID))

		_, secondCookie := loginWithRememberMeClient(t, app, user.Username, user.Password)
		assert.Equal(t, int64(1), getRememberMeTokenCount(app, user.ID),
			"only one valid token should exist after second login")

		assert.NotEqual(t, firstCookie.Value, secondCookie.Value,
			"second login should produce a different token")

		require.NoError(t, app.SessionHelper.CleanSessionTables())
		restoreSessionWithCookie(t, app, firstCookie)
		app.SessionHelper.AssertSessionNotExists(t, user.ID)

		restoreSessionWithCookie(t, app, secondCookie)
		app.SessionHelper.AssertSessionExists(t, user.ID)
	})
}
