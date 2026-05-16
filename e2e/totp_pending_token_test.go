package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTOTPPendingTokenRejectedOnProtectedRoutes(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("totp_pending token rejected by protected route", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "totp_pending_vuln_user",
			Email:    "totp_pending_vuln@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		seedValidTOTPSecret(t, app, user.ID)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var totpChallenge response.Response[auth.AuthTOTPRequiredData]
		require.NoError(t, loginResp.GetJSON(&totpChallenge))
		require.True(t, totpChallenge.Data.TOTPRequired, "login must signal TOTP is required")
		require.NotEmpty(t, totpChallenge.Data.TemporaryToken, "login must issue a temporary token")

		pendingToken := totpChallenge.Data.TemporaryToken

		profileResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
			Headers: map[string]string{
				"Authorization": "Bearer " + pendingToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, profileResp.StatusCode,
			"totp_pending token must not authenticate a protected route before 2FA is completed")
	})

	t.Run("totp_pending token rejected by admin route", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/users", e2etesting.CategorySecurity, e2etesting.ValueHigh)

		admin := &e2etesting.TestUser{
			Username: "totp_pending_admin_vuln",
			Email:    "totp_pending_admin_vuln@example.com",
			Password: "password123",
		}
		app.CreateAdminTestUser(t, admin)
		seedValidTOTPSecret(t, app, admin.ID)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: admin.Username,
			Password: admin.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var totpChallenge response.Response[auth.AuthTOTPRequiredData]
		require.NoError(t, loginResp.GetJSON(&totpChallenge))
		require.True(t, totpChallenge.Data.TOTPRequired)
		pendingToken := totpChallenge.Data.TemporaryToken

		adminResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + pendingToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, adminResp.StatusCode,
			"totp_pending token must not reach an admin route before 2FA is completed")
	})

	t.Run("normal access token works after totp verification", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

		user := &e2etesting.TestUser{
			Username: "totp_pending_control_user",
			Email:    "totp_pending_control@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: user.Username,
			Password: user.Password,
		})
		require.NoError(t, err)
		require.Equal(t, 200, loginResp.StatusCode)

		var login response.Response[auth.AuthLoginData]
		require.NoError(t, loginResp.GetJSON(&login))

		profileResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
			Headers: map[string]string{
				"Authorization": "Bearer " + login.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, profileResp.StatusCode,
			"normal access token (no TOTP required) should work on protected routes")
	})
}
