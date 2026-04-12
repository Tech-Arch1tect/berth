package e2e

import (
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordResetFullFlow(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("happy path via email capture", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset", e2etesting.CategoryIntegration, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "pwreset_happy",
			Email:    "pwreset_happy@example.com",
			Password: "oldpassword123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()

		resp, err := app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		resetMails := app.Mail.ByTemplate("password_reset")
		require.Len(t, resetMails, 1, "exactly one password_reset email should be sent")

		mail := resetMails[0]
		assert.Equal(t, []string{user.Email}, mail.To)
		assert.Contains(t, mail.Subject, "Password Reset")

		resetURL, ok := mail.Data["ResetURL"].(string)
		require.True(t, ok, "ResetURL should be a string in email data")
		assert.Contains(t, resetURL, "/auth/password-reset/confirm?token=")

		token := extractTokenFromURL(t, resetURL)
		assert.NotEmpty(t, token)
		assert.Len(t, token, 64, "token should be 64 hex chars (32 bytes)")

		assert.Equal(t, user.Email, mail.Data["Email"])
		assert.NotNil(t, mail.Data["ExpiryDuration"], "ExpiryDuration should be present")

		newPassword := "newpassword456"
		resp, err = app.AuthHelper.ResetPassword(token, newPassword)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		successMails := app.Mail.ByTemplate("password_reset_success")
		require.Len(t, successMails, 1, "exactly one password_reset_success email should be sent")
		assert.Equal(t, []string{user.Email}, successMails[0].To)

		resp, err = app.AuthHelper.Login(user.Username, newPassword)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)

		resp, err = app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginFailed(t, resp)
	})

	t.Run("flash messages on request", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "pwreset_flash_req",
			Email:    "pwreset_flash_req@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset", map[string][]string{
			"email": {user.Email},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		props := extractInertiaProps(t, loginResp.Body)
		flashes := props["flashMessages"]
		require.NotNil(t, flashes, "flash messages should be present after password reset request")

		flashStr := string(loginResp.Body)
		assert.Contains(t, flashStr, "If an account with that email exists")
	})

	t.Run("flash messages on completion", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "pwreset_flash_comp",
			Email:    "pwreset_flash_comp@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()
		_, err := app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)

		token := extractTokenFromCapturedMail(t, app)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset/confirm", map[string][]string{
			"token":            {token},
			"password":         {"newpassword789"},
			"password_confirm": {"newpassword789"},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		assert.Contains(t, string(loginResp.Body), "Your password has been reset successfully")
	})
}

func TestPasswordResetSessionInvalidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "pwreset_session",
		Email:    "pwreset_session@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	verifyUser(t, app, user)

	loggedInClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	resp, err := loggedInClient.Get("/")
	require.NoError(t, err)
	resp.AssertStatus(t, 200)

	app.Mail.Reset()
	_, err = app.AuthHelper.RequestPasswordReset(user.Email)
	require.NoError(t, err)
	token := extractTokenFromCapturedMail(t, app)

	_, err = app.AuthHelper.ResetPassword(token, "changedpassword456")
	require.NoError(t, err)

	resp, err = loggedInClient.WithoutRedirects().Get("/")
	require.NoError(t, err)
	app.SessionHelper.AssertAuthenticationRequired(t, resp)
}

func TestPasswordResetTokenReuse(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "pwreset_reuse",
		Email:    "pwreset_reuse@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	verifyUser(t, app, user)

	app.Mail.Reset()
	_, err := app.AuthHelper.RequestPasswordReset(user.Email)
	require.NoError(t, err)
	token := extractTokenFromCapturedMail(t, app)

	resp, err := app.AuthHelper.ResetPassword(token, "firstnewpass123")
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	resp, err = app.AuthHelper.ResetPassword(token, "secondnewpass123")
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/password-reset")

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
		t.Fatal(err)
	}
	resp, err = client.PostForm("/auth/password-reset/confirm", map[string][]string{
		"token":            {token},
		"password":         {"secondnewpass123"},
		"password_confirm": {"secondnewpass123"},
	})
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/password-reset")

	loginResp, err := client.Get("/auth/password-reset")
	require.NoError(t, err)
	assert.Contains(t, string(loginResp.Body), "already been used")

	resp, err = app.AuthHelper.Login(user.Username, "firstnewpass123")
	require.NoError(t, err)
	app.AuthHelper.AssertLoginSuccess(t, resp)

	resp, err = app.AuthHelper.Login(user.Username, "secondnewpass123")
	require.NoError(t, err)
	app.AuthHelper.AssertLoginFailed(t, resp)
}

func TestPasswordResetAntiEnumeration(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/auth/password-reset", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	app.Mail.Reset()

	resp, err := app.AuthHelper.RequestPasswordReset("doesnotexist@example.com")
	require.NoError(t, err)

	resp.AssertRedirect(t, "/auth/login")

	assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for nonexistent address")
}

func TestPasswordResetValidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "pwreset_validation",
		Email:    "pwreset_validation@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	verifyUser(t, app, user)

	app.Mail.Reset()
	_, err := app.AuthHelper.RequestPasswordReset(user.Email)
	require.NoError(t, err)
	token := extractTokenFromCapturedMail(t, app)

	t.Run("password mismatch", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset/confirm", map[string][]string{
			"token":            {token},
			"password":         {"newpassword123"},
			"password_confirm": {"differentpassword"},
		})
		require.NoError(t, err)
		assert.Contains(t, resp.Header.Get("Location"), "/auth/password-reset/confirm?token=")

		loc := resp.Header.Get("Location")
		confirmResp, err := client.Get(loc)
		require.NoError(t, err)
		assert.Contains(t, string(confirmResp.Body), "Passwords do not match")
	})

	t.Run("empty password", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset/confirm", map[string][]string{
			"token":            {token},
			"password":         {""},
			"password_confirm": {""},
		})
		require.NoError(t, err)
		assert.Contains(t, resp.Header.Get("Location"), "/auth/password-reset/confirm?token=")

		loc := resp.Header.Get("Location")
		confirmResp, err := client.Get(loc)
		require.NoError(t, err)
		assert.Contains(t, string(confirmResp.Body), "Password and confirmation are required")
	})

	t.Run("empty token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset/confirm", map[string][]string{
			"token":            {""},
			"password":         {"newpassword123"},
			"password_confirm": {"newpassword123"},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/password-reset")
	})

	t.Run("invalid token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

		resp, err := app.AuthHelper.ResetPassword("completely-bogus-token", "newpassword123")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/password-reset")
	})

	t.Run("password too short rejected without consuming token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset/confirm", e2etesting.CategoryValidation, e2etesting.ValueHigh)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset/confirm", map[string][]string{
			"token":            {token},
			"password":         {"short"},
			"password_confirm": {"short"},
		})
		require.NoError(t, err)
		assert.Contains(t, resp.Header.Get("Location"), "/auth/password-reset/confirm?token=")

		resp, err = app.AuthHelper.ResetPassword(token, "validpassword123")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		resp, err = app.AuthHelper.Login(user.Username, "validpassword123")
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})
}

func TestPasswordResetRequestValidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("empty email", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset", e2etesting.CategoryValidation, e2etesting.ValueLow)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/password-reset"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/password-reset", map[string][]string{
			"email": {""},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/password-reset")

		pageResp, err := client.Get("/auth/password-reset")
		require.NoError(t, err)
		assert.Contains(t, string(pageResp.Body), "Email is required")
	})

	t.Run("multiple requests generate multiple tokens", func(t *testing.T) {
		TagTest(t, "POST", "/auth/password-reset", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "pwreset_multi",
			Email:    "pwreset_multi@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()

		_, err := app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)
		_, err = app.AuthHelper.RequestPasswordReset(user.Email)
		require.NoError(t, err)

		resetMails := app.Mail.ByTemplate("password_reset")
		require.Len(t, resetMails, 2, "two password_reset emails should be sent")

		token1 := extractTokenFromURL(t, resetMails[0].Data["ResetURL"].(string))
		token2 := extractTokenFromURL(t, resetMails[1].Data["ResetURL"].(string))
		assert.NotEqual(t, token1, token2, "each request should generate a unique token")

		resp, err := app.AuthHelper.ResetPassword(token1, "firsttoken_pass123")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/password-reset")

		resp, err = app.AuthHelper.ResetPassword(token2, "secondtoken_pass123")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		resp, err = app.AuthHelper.Login(user.Username, "secondtoken_pass123")
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})
}

func extractTokenFromURL(t *testing.T, resetURL string) string {
	t.Helper()
	const marker = "token="
	idx := strings.Index(resetURL, marker)
	require.NotEqual(t, -1, idx, "reset URL should contain token= parameter: %s", resetURL)
	return resetURL[idx+len(marker):]
}

func extractTokenFromCapturedMail(t *testing.T, app *TestApp) string {
	t.Helper()
	resetMails := app.Mail.ByTemplate("password_reset")
	require.NotEmpty(t, resetMails, "expected at least one password_reset email")
	last := resetMails[len(resetMails)-1]
	resetURL, ok := last.Data["ResetURL"].(string)
	require.True(t, ok, "ResetURL should be a string")
	return extractTokenFromURL(t, resetURL)
}

func verifyUser(t *testing.T, app *TestApp, user *e2etesting.TestUser) {
	t.Helper()
	err := app.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", "2026-01-01 00:00:00").Error
	require.NoError(t, err, "failed to verify test user email")
}
