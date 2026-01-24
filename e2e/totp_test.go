package e2e

import (
	"net/url"
	"testing"
	"time"

	"berth/handlers"

	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestTOTPSetupAPI(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/totp/setup returns QR code and secret for authenticated user", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/setup", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "totpsetupuser1",
			Email:    "totpsetupuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		setupResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, setupResp.StatusCode)

		var setup handlers.TOTPSetupResponse
		require.NoError(t, setupResp.GetJSON(&setup))
		assert.NotEmpty(t, setup.Data.Secret, "secret should not be empty")
		assert.NotEmpty(t, setup.Data.QRCodeURI, "QR code URI should not be empty")
		assert.Contains(t, setup.Data.QRCodeURI, "otpauth://totp/")
	})

	t.Run("GET /api/v1/totp/setup requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/setup", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/totp/setup returns 409 when TOTP already enabled", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/setup", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpsetupconflict",
			Email:    "totpsetupconflict@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		setupResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, setupResp.StatusCode)

		var setup handlers.TOTPSetupResponse
		require.NoError(t, setupResp.GetJSON(&setup))

		validCode, err := totp.GenerateCode(setup.Data.Secret, time.Now())
		require.NoError(t, err)

		enableResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPEnableRequest{
				Code: validCode,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, enableResp.StatusCode)

		conflictResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 409, conflictResp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, conflictResp.GetJSON(&errResp))
		assert.Equal(t, "totp_already_enabled", errResp.Error)
	})

	t.Run("login with TOTP enabled returns TOTP required response", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "totpsetupuser2",
			Email:    "totpsetupuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		app.AuthHelper.EnableTOTPForUser(t, user.ID)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		assert.True(t, login.TOTPRequired, "should require TOTP verification")
		assert.NotEmpty(t, login.TemporaryToken, "should provide temporary token for TOTP verification")
		assert.Empty(t, login.AccessToken, "should not provide access token until TOTP verified")
	})
}

func TestTOTPEnableAPI(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("POST /api/v1/totp/enable requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/enable", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Body: handlers.TOTPEnableRequest{
				Code: "123456",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/totp/enable requires code", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/enable", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpenableuser1",
			Email:    "totpenableuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "validation_error", errResp.Error)
	})

	t.Run("POST /api/v1/totp/enable with invalid code returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/enable", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpenableuser2",
			Email:    "totpenableuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		_, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPEnableRequest{
				Code: "000000", // Invalid code
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_totp_code", errResp.Error)
	})

	t.Run("POST /api/v1/totp/enable with valid code enables TOTP", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/enable", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "totpenableuser3",
			Email:    "totpenableuser3@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		setupResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, setupResp.StatusCode)

		var setup handlers.TOTPSetupResponse
		require.NoError(t, setupResp.GetJSON(&setup))
		require.NotEmpty(t, setup.Data.Secret)

		validCode, err := totp.GenerateCode(setup.Data.Secret, time.Now())
		require.NoError(t, err)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPEnableRequest{
				Code: validCode,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		statusResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status handlers.TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.True(t, status.Data.Enabled, "TOTP should be enabled after successful enable")
	})
}

func TestTOTPDisableAPI(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("POST /api/v1/totp/disable requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/disable", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/disable",
			Body: handlers.TOTPDisableRequest{
				Code:     "123456",
				Password: "password123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/totp/disable requires code and password - validation", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/disable", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpdisableuser1",
			Email:    "totpdisableuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/disable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"password": "password123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/totp/disable with invalid password returns 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/disable", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpdisableuser2",
			Email:    "totpdisableuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/disable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPDisableRequest{
				Code:     "123456",
				Password: "wrongpassword",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_password", errResp.Error)
	})

	t.Run("POST /api/v1/totp/disable with valid credentials disables TOTP", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/totp/disable", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "totpdisableuser3",
			Email:    "totpdisableuser3@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		setupResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, setupResp.StatusCode)

		var setup handlers.TOTPSetupResponse
		require.NoError(t, setupResp.GetJSON(&setup))
		require.NotEmpty(t, setup.Data.Secret)

		enableCode, err := totp.GenerateCode(setup.Data.Secret, time.Now())
		require.NoError(t, err)

		enableResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPEnableRequest{
				Code: enableCode,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, enableResp.StatusCode)

		time.Sleep(1 * time.Second)

		disableCode, err := totp.GenerateCode(setup.Data.Secret, time.Now())
		require.NoError(t, err)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/disable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPDisableRequest{
				Code:     disableCode,
				Password: user.Password,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		statusResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status handlers.TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.False(t, status.Data.Enabled, "TOTP should be disabled after successful disable")
	})
}

func TestTOTPUIPages(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /auth/totp/setup redirects to login when unauthenticated", func(t *testing.T) {
		TagTest(t, "GET", "/auth/totp/setup", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.WithoutRedirects().Get("/auth/totp/setup")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("GET /auth/totp/setup accessible when authenticated", func(t *testing.T) {
		TagTest(t, "GET", "/auth/totp/setup", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := app.CreateVerifiedTestUser(t)
		authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := authenticatedClient.Get("/auth/totp/setup")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /auth/totp/verify redirects to login when unauthenticated", func(t *testing.T) {
		TagTest(t, "GET", "/auth/totp/verify", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.WithoutRedirects().Get("/auth/totp/verify")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("GET /auth/totp/verify redirects to home if TOTP not enabled", func(t *testing.T) {
		TagTest(t, "GET", "/auth/totp/verify", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpverifyuser1",
			Email:    "totpverifyuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := authenticatedClient.WithoutRedirects().Get("/auth/totp/verify")
		require.NoError(t, err)
		resp.AssertRedirect(t, "/")
	})

	t.Run("POST /auth/totp/verify redirects to login when unauthenticated", func(t *testing.T) {
		TagTest(t, "POST", "/auth/totp/verify", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.WithoutRedirects().PostForm("/auth/totp/verify", url.Values{
			"code": {"123456"},
		})
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("POST /auth/totp/verify with empty code returns validation error", func(t *testing.T) {
		TagTest(t, "POST", "/auth/totp/verify", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpverifyuser2",
			Email:    "totpverifyuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := authenticatedClient.WithoutRedirects().PostForm("/auth/totp/verify", url.Values{
			"code": {""},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/totp/verify")
	})

	t.Run("POST /auth/totp/verify with invalid code redirects back", func(t *testing.T) {
		TagTest(t, "POST", "/auth/totp/verify", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpverifyuser3",
			Email:    "totpverifyuser3@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		authenticatedClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		resp, err := authenticatedClient.WithoutRedirects().PostForm("/auth/totp/verify", url.Values{
			"code": {"000000"},
		})
		require.NoError(t, err)
		resp.AssertRedirect(t, "/auth/totp/verify")
	})
}

func TestTOTPStatusForAuthenticatedUser(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/totp/status requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/totp/status returns disabled for user without TOTP", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "totpstatususer1",
			Email:    "totpstatususer1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		statusResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status handlers.TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.False(t, status.Data.Enabled)
	})

	t.Run("GET /api/v1/totp/status returns enabled for user with TOTP enabled", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "totpstatususer2",
			Email:    "totpstatususer2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login LoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		setupResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/setup",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, setupResp.StatusCode)

		var setup handlers.TOTPSetupResponse
		require.NoError(t, setupResp.GetJSON(&setup))

		validCode, err := totp.GenerateCode(setup.Data.Secret, time.Now())
		require.NoError(t, err)

		enableResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/totp/enable",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
				"Content-Type":  "application/json",
			},
			Body: handlers.TOTPEnableRequest{
				Code: validCode,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, enableResp.StatusCode)

		statusResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status handlers.TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.True(t, status.Data.Enabled, "TOTP status should show enabled after activation")
	})
}
