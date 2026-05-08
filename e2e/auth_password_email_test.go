package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/pkg/config"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupEmailVerificationAPIApp(t *testing.T) *TestApp {
	return SetupTestAppWithConfig(t, func(cfg *config.Config) {
		cfg.Auth.EmailVerificationEnabled = true
	})
}

func TestAPIPasswordReset(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("happy path returns generic message and sends email", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "api_pwreset_happy",
			Email:    "api_pwreset_happy@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()

		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset", auth.AuthPasswordResetRequest{
			Email: user.Email,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "If an account with that email exists")

		mails := app.Mail.ByTemplate("password_reset")
		require.Len(t, mails, 1, "one password_reset email should be sent")
		assert.Equal(t, []string{user.Email}, mails[0].To)
	})

	t.Run("nonexistent email returns generic 200 without sending mail", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		app.Mail.Reset()

		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset", auth.AuthPasswordResetRequest{
			Email: "api_pwreset_nobody@example.com",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "If an account with that email exists")

		assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for nonexistent address")
	})

	t.Run("missing email returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset", auth.AuthPasswordResetRequest{
			Email: "",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestAPIPasswordResetConfirm(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("happy path resets the password", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset/confirm", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "api_pwconfirm_happy",
			Email:    "api_pwconfirm_happy@example.com",
			Password: "oldpassword123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()
		_, err := app.HTTPClient.Post("/api/v1/auth/password-reset", auth.AuthPasswordResetRequest{
			Email: user.Email,
		})
		require.NoError(t, err)
		token := extractTokenFromCapturedMail(t, app)

		newPassword := "newpassword456"
		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset/confirm", auth.AuthPasswordResetConfirmRequest{
			Token:                token,
			Password:             newPassword,
			PasswordConfirmation: newPassword,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "password has been reset successfully")

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: user.Username,
			Password: newPassword,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, loginResp.StatusCode)
	})

	t.Run("invalid token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset/confirm", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset/confirm", auth.AuthPasswordResetConfirmRequest{
			Token:                "completely-bogus-token",
			Password:             "newpassword456",
			PasswordConfirmation: "newpassword456",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errBody response.ErrorResponseBody
		require.NoError(t, resp.GetJSON(&errBody))
		assert.False(t, errBody.Success)
		assert.Equal(t, "invalid_token", errBody.Error.Code)
	})

	t.Run("mismatched password returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/password-reset/confirm", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/password-reset/confirm", auth.AuthPasswordResetConfirmRequest{
			Token:                "any-token",
			Password:             "newpassword456",
			PasswordConfirmation: "differentpassword",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestAPIVerifyEmail(t *testing.T) {
	t.Parallel()
	app := setupEmailVerificationAPIApp(t)

	t.Run("happy path verifies the email", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/verify-email", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "api_verify_happy",
			Email:    "api_verify_happy@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		app.AuthHelper.AssertEmailNotVerified(t, user.Email)

		app.Mail.Reset()
		_, err := app.HTTPClient.Post("/api/v1/auth/resend-verification", auth.AuthResendVerificationRequest{
			Email: user.Email,
		})
		require.NoError(t, err)

		mails := app.Mail.ByTemplate("email_verification")
		require.Len(t, mails, 1, "one email_verification email should be sent")
		verificationURL, ok := mails[0].Data["VerificationURL"].(string)
		require.True(t, ok)
		token := extractVerificationTokenFromURL(t, verificationURL)

		resp, err := app.HTTPClient.Post("/api/v1/auth/verify-email", auth.AuthVerifyEmailRequest{
			Token: token,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "email has been verified")

		app.AuthHelper.AssertEmailVerified(t, user.Email)
	})

	t.Run("invalid token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/verify-email", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/verify-email", auth.AuthVerifyEmailRequest{
			Token: "completely-bogus-token",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errBody response.ErrorResponseBody
		require.NoError(t, resp.GetJSON(&errBody))
		assert.False(t, errBody.Success)
		assert.Equal(t, "invalid_token", errBody.Error.Code)
	})

	t.Run("missing token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/verify-email", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/verify-email", auth.AuthVerifyEmailRequest{
			Token: "",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestAPIResendVerification(t *testing.T) {
	t.Parallel()
	app := setupEmailVerificationAPIApp(t)

	t.Run("happy path returns generic message and sends email", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/resend-verification", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "api_resend_happy",
			Email:    "api_resend_happy@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		app.Mail.Reset()

		resp, err := app.HTTPClient.Post("/api/v1/auth/resend-verification", auth.AuthResendVerificationRequest{
			Email: user.Email,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "verification email will be sent")

		mails := app.Mail.ByTemplate("email_verification")
		require.Len(t, mails, 1, "one email_verification email should be sent")
		assert.Equal(t, []string{user.Email}, mails[0].To)
	})

	t.Run("nonexistent email returns generic 200 without sending mail", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/resend-verification", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		app.Mail.Reset()

		resp, err := app.HTTPClient.Post("/api/v1/auth/resend-verification", auth.AuthResendVerificationRequest{
			Email: "api_resend_nobody@example.com",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)
		assert.Contains(t, body.Data.Message, "verification email will be sent")

		assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for nonexistent address")
	})

	t.Run("already verified email returns generic 200 without sending mail", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/resend-verification", e2etesting.CategorySecurity, e2etesting.ValueMedium)

		user := &e2etesting.TestUser{
			Username: "api_resend_verified",
			Email:    "api_resend_verified@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		verifyUser(t, app, user)

		app.Mail.Reset()

		resp, err := app.HTTPClient.Post("/api/v1/auth/resend-verification", auth.AuthResendVerificationRequest{
			Email: user.Email,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var body response.Response[auth.AuthMessageData]
		require.NoError(t, resp.GetJSON(&body))
		assert.True(t, body.Success)

		assert.Equal(t, 0, app.Mail.Len(), "no email should be sent for already-verified address")
	})

	t.Run("missing email returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/resend-verification", e2etesting.CategoryValidation, e2etesting.ValueMedium)

		resp, err := app.HTTPClient.Post("/api/v1/auth/resend-verification", auth.AuthResendVerificationRequest{
			Email: "",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}
