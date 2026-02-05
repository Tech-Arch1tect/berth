package e2e

import (
	"berth/handlers"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestAPILogin(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("successful login returns tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apiloginuser1",
			Email:    "apiloginuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var loginResp handlers.AuthLoginResponse
		require.NoError(t, resp.GetJSON(&loginResp))

		assert.True(t, loginResp.Success)
		assert.NotEmpty(t, loginResp.Data.AccessToken)
		assert.NotEmpty(t, loginResp.Data.RefreshToken)
		assert.Equal(t, "Bearer", loginResp.Data.TokenType)
		assert.Equal(t, 900, loginResp.Data.ExpiresIn)
		assert.Greater(t, loginResp.Data.RefreshExpiresIn, 0)
		assert.Equal(t, user.Username, loginResp.Data.User.Username)
		assert.Equal(t, user.Email, loginResp.Data.User.Email)
	})

	t.Run("invalid credentials returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apiloginuser2",
			Email:    "apiloginuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: "wrongpassword",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp handlers.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.False(t, errResp.Success)
		assert.Equal(t, "invalid_credentials", errResp.Error)
	})

	t.Run("nonexistent user returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: "nonexistent",
			Password: "password",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp handlers.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.False(t, errResp.Success)
		assert.Equal(t, "invalid_credentials", errResp.Error)
	})
}

func TestAPIRefresh(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("valid refresh token returns new tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apirefreshuser1",
			Email:    "apirefreshuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login handlers.AuthLoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: login.Data.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, refreshResp.StatusCode)

		var refresh handlers.AuthRefreshResponse
		require.NoError(t, refreshResp.GetJSON(&refresh))

		assert.True(t, refresh.Success)
		assert.NotEmpty(t, refresh.Data.AccessToken)
		assert.NotEmpty(t, refresh.Data.RefreshToken)
		assert.Equal(t, "Bearer", refresh.Data.TokenType)
		assert.NotEqual(t, login.Data.AccessToken, refresh.Data.AccessToken)
	})

	t.Run("invalid refresh token returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: "invalid-token",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp handlers.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.False(t, errResp.Success)
		assert.Equal(t, "invalid_token", errResp.Error)
	})
}

func TestAPILogout(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("logout revokes tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/logout", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apilogoutuser1",
			Email:    "apilogoutuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login handlers.AuthLoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		logoutResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/logout",
			Body: handlers.AuthLogoutRequest{
				RefreshToken: login.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, logoutResp.StatusCode)

		var logout handlers.AuthLogoutResponse
		require.NoError(t, logoutResp.GetJSON(&logout))
		assert.True(t, logout.Success)
		assert.Contains(t, logout.Data.Message, "Logout successful")

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: login.Data.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 401, refreshResp.StatusCode)
	})
}

func TestAPIProfile(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("authenticated user can get profile", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apiprofileuser1",
			Email:    "apiprofileuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login handlers.AuthLoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		profileResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, profileResp.StatusCode)

		var profile handlers.GetProfileResponse
		require.NoError(t, profileResp.GetJSON(&profile))
		assert.Equal(t, user.Username, profile.Data.Username)
		assert.Equal(t, user.Email, profile.Data.Email)
	})

	t.Run("unauthenticated request returns error", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestAPITOTPStatus(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("new user has TOTP disabled", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apitotpuser1",
			Email:    "apitotpuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login handlers.AuthLoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		statusResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/totp/status",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status handlers.TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.True(t, status.Success)
		assert.False(t, status.Data.Enabled)
	})
}

func TestAPISessions(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("list sessions returns current session", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apisessionsuser1",
			Email:    "apisessionsuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login handlers.AuthLoginResponse
		require.NoError(t, loginResp.GetJSON(&login))

		sessionsResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions",
			Body: handlers.GetSessionsRequest{
				RefreshToken: login.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, sessionsResp.StatusCode)

		var sessions handlers.GetSessionsResponse
		require.NoError(t, sessionsResp.GetJSON(&sessions))
		assert.True(t, sessions.Success)
		assert.GreaterOrEqual(t, len(sessions.Data.Sessions), 1)

		var foundCurrent bool
		for _, s := range sessions.Data.Sessions {
			if s.Current {
				foundCurrent = true
				break
			}
		}
		assert.True(t, foundCurrent, "should have a current session")
	})

	t.Run("revoke all other sessions", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apisessionsuser2",
			Email:    "apisessionsuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		login1Resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login1 handlers.AuthLoginResponse
		require.NoError(t, login1Resp.GetJSON(&login1))

		login2Resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login2 handlers.AuthLoginResponse
		require.NoError(t, login2Resp.GetJSON(&login2))

		revokeResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke-all-others",
			Body: handlers.RevokeAllOtherSessionsRequest{
				RefreshToken: login2.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login2.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, revokeResp.StatusCode)

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: login1.Data.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 401, refreshResp.StatusCode)

		refreshResp2, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: login2.Data.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, refreshResp2.StatusCode)
	})
}

func TestAPITOTPVerify(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("POST /api/v1/auth/totp/verify requires code", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/totp/verify", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/totp/verify",
			Headers: map[string]string{
				"Authorization": "Bearer some-temp-token",
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/auth/totp/verify requires authorization header", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/totp/verify", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/totp/verify",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: map[string]interface{}{
				"code": "123456",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/auth/totp/verify with invalid token returns 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/totp/verify", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/totp/verify",
			Headers: map[string]string{
				"Authorization": "Bearer invalid-token",
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"code": "123456",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
