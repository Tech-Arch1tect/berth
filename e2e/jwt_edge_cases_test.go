package e2e

import (
	"berth/internal/domain/auth"
	"berth/internal/domain/session"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiLogin(t *testing.T, app *TestApp, username, email, password string) auth.AuthLoginResponse {
	t.Helper()
	app.AuthHelper.CreateTestUser(t, &e2etesting.TestUser{
		Username: username,
		Email:    email,
		Password: password,
	})
	resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: username,
		Password: password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)
	var login auth.AuthLoginResponse
	require.NoError(t, resp.GetJSON(&login))
	require.True(t, login.Success)
	return login
}

func apiRefresh(t *testing.T, app *TestApp, refreshToken string) (auth.AuthRefreshResponse, int) {
	t.Helper()
	resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
		RefreshToken: refreshToken,
	})
	require.NoError(t, err)
	if resp.StatusCode != 200 {
		return auth.AuthRefreshResponse{}, resp.StatusCode
	}
	var refresh auth.AuthRefreshResponse
	require.NoError(t, resp.GetJSON(&refresh))
	return refresh, resp.StatusCode
}

func apiGetProfile(t *testing.T, app *TestApp, accessToken string) int {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "GET",
		Path:   "/api/v1/profile",
		Headers: map[string]string{
			"Authorization": "Bearer " + accessToken,
		},
	})
	require.NoError(t, err)
	return resp.StatusCode
}

func apiLogout(t *testing.T, app *TestApp, accessToken, refreshToken string) int {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/auth/logout",
		Body: auth.AuthLogoutRequest{
			RefreshToken: refreshToken,
		},
		Headers: map[string]string{
			"Authorization": "Bearer " + accessToken,
		},
	})
	require.NoError(t, err)
	return resp.StatusCode
}

func TestJWTAccessTokenRevocation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("access token rejected after logout", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		login := apiLogin(t, app, "jwtrevoke1", "jwtrevoke1@example.com", "password123")

		assert.Equal(t, 200, apiGetProfile(t, app, login.Data.AccessToken))
		assert.Equal(t, 200, apiLogout(t, app, login.Data.AccessToken, login.Data.RefreshToken))
		assert.Equal(t, 401, apiGetProfile(t, app, login.Data.AccessToken))
	})

	t.Run("refresh token rejected after logout", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		login := apiLogin(t, app, "jwtrevoke2", "jwtrevoke2@example.com", "password123")

		assert.Equal(t, 200, apiLogout(t, app, login.Data.AccessToken, login.Data.RefreshToken))

		_, status := apiRefresh(t, app, login.Data.RefreshToken)
		assert.Equal(t, 401, status)
		assert.Equal(t, 401, apiGetProfile(t, app, login.Data.AccessToken))
	})
}

func TestJWTTokenRotation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("refresh issues new tokens and rotates refresh token", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		login := apiLogin(t, app, "jwtrotate1", "jwtrotate1@example.com", "password123")

		refresh, status := apiRefresh(t, app, login.Data.RefreshToken)
		require.Equal(t, 200, status)

		assert.NotEqual(t, login.Data.AccessToken, refresh.Data.AccessToken, "new access token issued")
		assert.NotEqual(t, login.Data.RefreshToken, refresh.Data.RefreshToken, "refresh token rotated")
		assert.Equal(t, "Bearer", refresh.Data.TokenType)
		assert.Equal(t, 900, refresh.Data.ExpiresIn)
		assert.Greater(t, refresh.Data.RefreshExpiresIn, 0)
	})

	t.Run("old refresh token rejected after rotation", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		login := apiLogin(t, app, "jwtrotate2", "jwtrotate2@example.com", "password123")

		refresh1, status := apiRefresh(t, app, login.Data.RefreshToken)
		require.Equal(t, 200, status)

		_, status = apiRefresh(t, app, login.Data.RefreshToken)
		assert.Equal(t, 401, status, "old refresh token must be rejected after rotation")

		refresh2, status := apiRefresh(t, app, refresh1.Data.RefreshToken)
		assert.Equal(t, 200, status)
		assert.NotEqual(t, refresh1.Data.RefreshToken, refresh2.Data.RefreshToken)
	})

	t.Run("old access token still works after refresh", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtrotate3", "jwtrotate3@example.com", "password123")

		refresh, status := apiRefresh(t, app, login.Data.RefreshToken)
		require.Equal(t, 200, status)

		assert.Equal(t, 200, apiGetProfile(t, app, login.Data.AccessToken), "old access token still valid")
		assert.Equal(t, 200, apiGetProfile(t, app, refresh.Data.AccessToken), "new access token valid")
	})

	t.Run("chained refreshes work", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtrotate4", "jwtrotate4@example.com", "password123")

		currentRefresh := login.Data.RefreshToken
		for i := 0; i < 5; i++ {
			refresh, status := apiRefresh(t, app, currentRefresh)
			require.Equal(t, 200, status, "chain refresh %d failed", i+1)
			assert.NotEqual(t, currentRefresh, refresh.Data.RefreshToken)
			assert.Equal(t, 200, apiGetProfile(t, app, refresh.Data.AccessToken))
			currentRefresh = refresh.Data.RefreshToken
		}
	})
}

func TestJWTRefreshValidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("empty refresh token", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
			RefreshToken: "",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp auth.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "validation_error", errResp.Error)
	})

	t.Run("garbage refresh token", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", auth.AuthRefreshRequest{
			RefreshToken: "not-a-real-token-at-all",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)

		var errResp auth.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_token", errResp.Error)
	})

	t.Run("malformed request body", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryValidation, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/auth/refresh",
			Body:    "not json",
			Headers: map[string]string{"Content-Type": "application/json"},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestJWTLogoutEdgeCases(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("logout without refresh token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/logout", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtlogout1", "jwtlogout1@example.com", "password123")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/auth/logout",
			Body:   auth.AuthLogoutRequest{RefreshToken: ""},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp auth.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "validation_error", errResp.Error)
	})

	t.Run("double logout is safe", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/logout", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtlogout2", "jwtlogout2@example.com", "password123")

		assert.Equal(t, 200, apiLogout(t, app, login.Data.AccessToken, login.Data.RefreshToken))

		status := apiLogout(t, app, login.Data.AccessToken, login.Data.RefreshToken)
		assert.Equal(t, 401, status, "revoked access token should be rejected by auth middleware")
	})
}

func TestJWTSingleSessionRevocation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("revoke specific session by ID", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		apiLogin(t, app, "jwtsessrev1", "jwtsessrev1@example.com", "password123")

		resp2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: "jwtsessrev1",
			Password: "password123",
		})
		require.NoError(t, err)
		var login2 auth.AuthLoginResponse
		require.NoError(t, resp2.GetJSON(&login2))

		sessResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions",
			Body: session.GetSessionsRequest{
				RefreshToken: login2.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login2.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, sessResp.StatusCode)

		var sessions session.GetSessionsResponse
		require.NoError(t, sessResp.GetJSON(&sessions))
		require.GreaterOrEqual(t, len(sessions.Data.Sessions), 2, "should have at least 2 sessions")

		var targetSessionID uint
		for _, s := range sessions.Data.Sessions {
			if !s.Current {
				targetSessionID = s.ID
				break
			}
		}
		require.NotZero(t, targetSessionID, "should find a non-current session to revoke")

		revokeResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke",
			Body:   session.RevokeSessionRequest{SessionID: targetSessionID},
			Headers: map[string]string{
				"Authorization": "Bearer " + login2.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, revokeResp.StatusCode)

		assert.Equal(t, 200, apiGetProfile(t, app, login2.Data.AccessToken))

		sessResp2, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions",
			Body: session.GetSessionsRequest{
				RefreshToken: login2.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login2.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		var sessions2 session.GetSessionsResponse
		require.NoError(t, sessResp2.GetJSON(&sessions2))
		assert.Less(t, len(sessions2.Data.Sessions), len(sessions.Data.Sessions), "session count should decrease after revocation")
	})

	t.Run("revoke session with zero ID returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtsessrev2", "jwtsessrev2@example.com", "password123")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke",
			Body:   session.RevokeSessionRequest{SessionID: 0},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp auth.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "validation_error", errResp.Error)
	})
}

func TestJWTRevokeAllOtherSessionsEdgeCases(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("revoke all others with invalid refresh token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtrevall1", "jwtrevall1@example.com", "password123")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke-all-others",
			Body: session.RevokeAllOtherSessionsRequest{
				RefreshToken: "garbage-token",
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)

		var errResp auth.AuthErrorResponse
		require.NoError(t, resp.GetJSON(&errResp))
		assert.Equal(t, "invalid_token", errResp.Error)
	})

	t.Run("revoke all others with empty refresh token returns 400", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		login := apiLogin(t, app, "jwtrevall2", "jwtrevall2@example.com", "password123")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke-all-others",
			Body: session.RevokeAllOtherSessionsRequest{
				RefreshToken: "",
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("revoke all others preserves current session tokens", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		login1 := apiLogin(t, app, "jwtrevall3", "jwtrevall3@example.com", "password123")

		resp2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: "jwtrevall3", Password: "password123",
		})
		require.NoError(t, err)
		var login2 auth.AuthLoginResponse
		require.NoError(t, resp2.GetJSON(&login2))

		resp3, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: "jwtrevall3", Password: "password123",
		})
		require.NoError(t, err)
		var login3 auth.AuthLoginResponse
		require.NoError(t, resp3.GetJSON(&login3))

		revokeResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/sessions/revoke-all-others",
			Body: session.RevokeAllOtherSessionsRequest{
				RefreshToken: login3.Data.RefreshToken,
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + login3.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, revokeResp.StatusCode)

		refresh3, status := apiRefresh(t, app, login3.Data.RefreshToken)
		assert.Equal(t, 200, status)
		assert.NotEmpty(t, refresh3.Data.AccessToken)

		_, status1 := apiRefresh(t, app, login1.Data.RefreshToken)
		assert.Equal(t, 401, status1, "login1 refresh should be revoked")

		_, status2 := apiRefresh(t, app, login2.Data.RefreshToken)
		assert.Equal(t, 401, status2, "login2 refresh should be revoked")
	})
}

func TestJWTLoginValidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("empty username", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: "",
			Password: "password123",
		})
		require.NoError(t, err)
		assert.NotEqual(t, 200, resp.StatusCode)
	})

	t.Run("empty password", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/auth/login", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		app.AuthHelper.CreateTestUser(t, &e2etesting.TestUser{
			Username: "jwtloginval1",
			Email:    "jwtloginval1@example.com",
			Password: "password123",
		})
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: "jwtloginval1",
			Password: "",
		})
		require.NoError(t, err)
		assert.NotEqual(t, 200, resp.StatusCode)
	})
}
