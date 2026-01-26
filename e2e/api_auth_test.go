package e2e

import (
	"berth/handlers"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"refresh_token"`
	TokenType        string       `json:"token_type"`
	ExpiresIn        int          `json:"expires_in"`
	RefreshExpiresIn int          `json:"refresh_expires_in"`
	User             UserResponse `json:"user"`
	TOTPRequired     bool         `json:"totp_required"`
	TemporaryToken   string       `json:"temporary_token"`
	Message          string       `json:"message"`
}

type UserResponse struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	TOTPEnabled bool   `json:"totp_enabled"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type LogoutResponse struct {
	Message       string   `json:"message"`
	RevokedTokens []string `json:"revoked_tokens"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

type TOTPStatusResponse struct {
	Enabled bool `json:"enabled"`
}

type SessionsRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type SessionsResponse struct {
	Sessions []SessionInfo `json:"sessions"`
}

type SessionInfo struct {
	ID        uint   `json:"id"`
	UserID    uint   `json:"user_id"`
	Type      string `json:"type"`
	IPAddress string `json:"ip_address"`
	Browser   string `json:"browser"`
	Current   bool   `json:"current"`
}

func TestAPILogin(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("successful login returns tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apiloginuser1",
			Email:    "apiloginuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var loginResp LoginResponse
		require.NoError(t, resp.GetJSON(&loginResp))

		assert.NotEmpty(t, loginResp.AccessToken)
		assert.NotEmpty(t, loginResp.RefreshToken)
		assert.Equal(t, "Bearer", loginResp.TokenType)
		assert.Equal(t, 900, loginResp.ExpiresIn)
		assert.Greater(t, loginResp.RefreshExpiresIn, 0)
		assert.Equal(t, user.Username, loginResp.User.Username)
		assert.Equal(t, user.Email, loginResp.User.Email)
	})

	t.Run("invalid credentials returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apiloginuser2",
			Email:    "apiloginuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		resp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: "wrongpassword",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_credentials", errResp.Error)
	})

	t.Run("nonexistent user returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: "nonexistent",
			Password: "password",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_credentials", errResp.Error)
	})
}

func TestAPIRefresh(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("valid refresh token returns new tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apirefreshuser1",
			Email:    "apirefreshuser1@example.com",
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

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", RefreshRequest{
			RefreshToken: login.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, refreshResp.StatusCode)

		var refresh RefreshResponse
		require.NoError(t, refreshResp.GetJSON(&refresh))

		assert.NotEmpty(t, refresh.AccessToken)
		assert.NotEmpty(t, refresh.RefreshToken)
		assert.Equal(t, "Bearer", refresh.TokenType)
		assert.NotEqual(t, login.AccessToken, refresh.AccessToken)
	})

	t.Run("invalid refresh token returns error", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", RefreshRequest{
			RefreshToken: "invalid-token",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp ErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_token", errResp.Error)
	})
}

func TestAPILogout(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("logout revokes tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/logout", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "apilogoutuser1",
			Email:    "apilogoutuser1@example.com",
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

		logoutResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/logout",
			Body: LogoutRequest{
				RefreshToken: login.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, logoutResp.StatusCode)

		var logout LogoutResponse
		require.NoError(t, logoutResp.GetJSON(&logout))
		assert.Contains(t, logout.Message, "Logout successful")

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", RefreshRequest{
			RefreshToken: login.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 401, refreshResp.StatusCode)
	})
}

func TestAPIProfile(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("authenticated user can get profile", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apiprofileuser1",
			Email:    "apiprofileuser1@example.com",
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

		profileResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
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
	app := SetupTestApp(t)

	t.Run("new user has TOTP disabled", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apitotpuser1",
			Email:    "apitotpuser1@example.com",
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

		var status TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.False(t, status.Enabled)
	})
}

func TestAPISessions(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("list sessions returns current session", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "apisessionsuser1",
			Email:    "apisessionsuser1@example.com",
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

		sessionsResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions",
			Body: SessionsRequest{
				RefreshToken: login.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, sessionsResp.StatusCode)

		var sessions SessionsResponse
		require.NoError(t, sessionsResp.GetJSON(&sessions))
		assert.GreaterOrEqual(t, len(sessions.Sessions), 1)

		var foundCurrent bool
		for _, s := range sessions.Sessions {
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

		login1Resp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login1 LoginResponse
		require.NoError(t, login1Resp.GetJSON(&login1))

		login2Resp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		var login2 LoginResponse
		require.NoError(t, login2Resp.GetJSON(&login2))

		revokeResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke-all-others",
			Body: SessionsRequest{
				RefreshToken: login2.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login2.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, revokeResp.StatusCode)

		refreshResp, err := app.HTTPClient.Post("/api/v1/auth/refresh", RefreshRequest{
			RefreshToken: login1.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 401, refreshResp.StatusCode)

		refreshResp2, err := app.HTTPClient.Post("/api/v1/auth/refresh", RefreshRequest{
			RefreshToken: login2.RefreshToken,
		})
		require.NoError(t, err)
		assert.Equal(t, 200, refreshResp2.StatusCode)
	})
}

func TestAPITOTPVerify(t *testing.T) {
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
