package e2e

import (
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/config"
)

func setupVerificationApp(t *testing.T) *TestApp {
	return SetupTestAppWithConfig(t, func(cfg *config.Config) {
		cfg.Auth.EmailVerificationEnabled = true
	})
}

func TestEmailVerificationFullFlow(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	t.Run("happy path via email capture", func(t *testing.T) {
		TagTest(t, "POST", "/auth/verify-email", e2etesting.CategoryIntegration, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "ev_happy",
			Email:    "ev_happy@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		app.AuthHelper.AssertEmailNotVerified(t, user.Email)

		resp, err := app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginFailed(t, resp)

		app.Mail.Reset()
		resp, err = app.AuthHelper.ResendVerification(user.Email)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		verificationMails := app.Mail.ByTemplate("email_verification")
		require.Len(t, verificationMails, 1, "exactly one email_verification email should be sent")

		mail := verificationMails[0]
		assert.Equal(t, []string{user.Email}, mail.To)
		assert.Contains(t, mail.Subject, "verify")

		verificationURL, ok := mail.Data["VerificationURL"].(string)
		require.True(t, ok, "VerificationURL should be a string in email data")
		assert.Contains(t, verificationURL, "/auth/verify-email?token=")

		token := extractVerificationTokenFromURL(t, verificationURL)
		assert.NotEmpty(t, token)
		assert.Len(t, token, 64, "token should be 64 hex chars (32 bytes)")

		assert.Equal(t, user.Email, mail.Data["Email"])
		assert.NotNil(t, mail.Data["ExpiryDuration"], "ExpiryDuration should be present")

		resp, err = app.AuthHelper.VerifyEmail(token)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		app.AuthHelper.AssertEmailVerified(t, user.Email)

		resp, err = app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)
		app.AuthHelper.AssertLoginSuccess(t, resp)
	})

	t.Run("flash messages on successful verification", func(t *testing.T) {
		TagTest(t, "POST", "/auth/verify-email", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "ev_flash_success",
			Email:    "ev_flash_success@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		app.Mail.Reset()
		_, err := app.AuthHelper.ResendVerification(user.Email)
		require.NoError(t, err)

		token := extractVerificationTokenFromCapturedMail(t, app)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/login"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.Post("/auth/verify-email?token="+token, nil)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		assert.Contains(t, string(loginResp.Body), "Your email has been verified successfully")
	})
}

func TestEmailVerificationLoginBlocked(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	TagTest(t, "POST", "/auth/login", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "ev_blocked",
		Email:    "ev_blocked@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		t.Fatal(err)
	}
	resp, err := client.PostForm("/auth/login", map[string][]string{
		"username": {user.Username},
		"password": {user.Password},
	})
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	loginResp, err := client.Get("/auth/login")
	require.NoError(t, err)
	body := string(loginResp.Body)
	assert.Contains(t, body, "Please verify your email before signing in")
	assert.Contains(t, body, "resend the verification email")
}

func TestEmailVerificationTokenReuse(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	TagTest(t, "POST", "/auth/verify-email", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	user := &e2etesting.TestUser{
		Username: "ev_reuse",
		Email:    "ev_reuse@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	app.Mail.Reset()
	_, err := app.AuthHelper.ResendVerification(user.Email)
	require.NoError(t, err)
	token := extractVerificationTokenFromCapturedMail(t, app)

	resp, err := app.AuthHelper.VerifyEmail(token)
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")
	app.AuthHelper.AssertEmailVerified(t, user.Email)

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		t.Fatal(err)
	}
	resp, err = client.Post("/auth/verify-email?token="+token, nil)
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	loginResp, err := client.Get("/auth/login")
	require.NoError(t, err)
	assert.Contains(t, string(loginResp.Body), "already been verified")
}

func TestEmailVerificationAntiEnumeration(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	TagTest(t, "POST", "/auth/resend-verification", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	app.Mail.Reset()

	resp, err := app.AuthHelper.ResendVerification("doesnotexist@example.com")
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for nonexistent address")

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		t.Fatal(err)
	}
	resp, err = client.PostForm("/auth/resend-verification", map[string][]string{
		"email": {"doesnotexist@example.com"},
	})
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	loginResp, err := client.Get("/auth/login")
	require.NoError(t, err)
	assert.Contains(t, string(loginResp.Body), "If an account with that email exists")
}

func TestEmailVerificationResendAlreadyVerified(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	TagTest(t, "POST", "/auth/resend-verification", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

	user := &e2etesting.TestUser{
		Username: "ev_already_verified",
		Email:    "ev_already_verified@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	verifyUser(t, app, user)

	app.Mail.Reset()

	client := app.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		t.Fatal(err)
	}
	resp, err := client.PostForm("/auth/resend-verification", map[string][]string{
		"email": {user.Email},
	})
	require.NoError(t, err)
	resp.AssertRedirect(t, "/auth/login")

	assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for already-verified address")

	loginResp, err := client.Get("/auth/login")
	require.NoError(t, err)
	assert.Contains(t, string(loginResp.Body), "already verified")
}

func TestEmailVerificationValidation(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	t.Run("empty token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/verify-email", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/login"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.Post("/auth/verify-email?token=", nil)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		assert.Contains(t, string(loginResp.Body), "Invalid verification link")
	})

	t.Run("invalid token", func(t *testing.T) {
		TagTest(t, "POST", "/auth/verify-email", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/login"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.Post("/auth/verify-email?token=completely-bogus-token", nil)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		assert.Contains(t, string(loginResp.Body), "Invalid verification link")
	})

	t.Run("GET verify-email without token redirects", func(t *testing.T) {
		TagTest(t, "GET", "/auth/verify-email", e2etesting.CategoryValidation, e2etesting.ValueLow)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		resp, err := client.Get("/auth/verify-email")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")
	})

	t.Run("GET verify-email with valid token renders page", func(t *testing.T) {
		TagTest(t, "GET", "/auth/verify-email", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "ev_show_page",
			Email:    "ev_show_page@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		app.Mail.Reset()
		_, err := app.AuthHelper.ResendVerification(user.Email)
		require.NoError(t, err)
		token := extractVerificationTokenFromCapturedMail(t, app)

		client := app.HTTPClient.WithCookieJar()
		resp, err := client.Get("/auth/verify-email?token=" + token)
		require.NoError(t, err)
		resp.AssertStatus(t, 200)
		assert.Contains(t, string(resp.Body), token)
	})
}

func TestEmailVerificationResendValidation(t *testing.T) {
	t.Parallel()
	app := setupVerificationApp(t)

	t.Run("empty email", func(t *testing.T) {
		TagTest(t, "POST", "/auth/resend-verification", e2etesting.CategoryValidation, e2etesting.ValueLow)

		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		if _, err := client.Get("/auth/login"); err != nil {
			t.Fatal(err)
		}
		resp, err := client.PostForm("/auth/resend-verification", map[string][]string{
			"email": {""},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		loginResp, err := client.Get("/auth/login")
		require.NoError(t, err)
		assert.Contains(t, string(loginResp.Body), "Email is required")
	})

	t.Run("multiple requests invalidate previous tokens", func(t *testing.T) {
		TagTest(t, "POST", "/auth/resend-verification", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "ev_multi_resend",
			Email:    "ev_multi_resend@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		app.Mail.Reset()

		_, err := app.AuthHelper.ResendVerification(user.Email)
		require.NoError(t, err)
		_, err = app.AuthHelper.ResendVerification(user.Email)
		require.NoError(t, err)

		verificationMails := app.Mail.ByTemplate("email_verification")
		require.Len(t, verificationMails, 2, "two verification emails should be sent")

		token1 := extractVerificationTokenFromURL(t, verificationMails[0].Data["VerificationURL"].(string))
		token2 := extractVerificationTokenFromURL(t, verificationMails[1].Data["VerificationURL"].(string))
		assert.NotEqual(t, token1, token2, "each request should generate a unique token")

		resp, err := app.AuthHelper.VerifyEmail(token1)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		app.AuthHelper.AssertEmailNotVerified(t, user.Email)

		resp, err = app.AuthHelper.VerifyEmail(token2)
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/login")

		app.AuthHelper.AssertEmailVerified(t, user.Email)
	})
}

func TestEmailVerificationDisabledByDefault(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/auth/login", e2etesting.CategoryIntegration, e2etesting.ValueMedium)

	user := &e2etesting.TestUser{
		Username: "ev_disabled",
		Email:    "ev_disabled@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	resp, err := app.AuthHelper.Login(user.Username, user.Password)
	require.NoError(t, err)
	app.AuthHelper.AssertLoginSuccess(t, resp)
}

func extractVerificationTokenFromURL(t *testing.T, verificationURL string) string {
	t.Helper()
	const marker = "token="
	idx := strings.Index(verificationURL, marker)
	require.NotEqual(t, -1, idx, "verification URL should contain token= parameter: %s", verificationURL)
	return verificationURL[idx+len(marker):]
}

func extractVerificationTokenFromCapturedMail(t *testing.T, app *TestApp) string {
	t.Helper()
	mails := app.Mail.ByTemplate("email_verification")
	require.NotEmpty(t, mails, "expected at least one email_verification email")
	last := mails[len(mails)-1]
	verificationURL, ok := last.Data["VerificationURL"].(string)
	require.True(t, ok, "VerificationURL should be a string")
	return extractVerificationTokenFromURL(t, verificationURL)
}
