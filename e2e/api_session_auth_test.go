package e2e

import (
	"berth/handlers"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestAPISessionAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("session auth can access profile endpoint", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "sessionauthuser1",
			Email:    "sessionauthuser1@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		profileResp, err := sessionClient.Get("/api/v1/profile")
		require.NoError(t, err)
		assert.Equal(t, 200, profileResp.StatusCode)

		var profile handlers.GetProfileResponse
		require.NoError(t, profileResp.GetJSON(&profile))
		assert.Equal(t, user.Username, profile.Data.Username)
		assert.Equal(t, user.Email, profile.Data.Email)
	})

	t.Run("session auth can access totp status endpoint", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/totp/status", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "sessionauthuser2",
			Email:    "sessionauthuser2@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		statusResp, err := sessionClient.Get("/api/v1/totp/status")
		require.NoError(t, err)
		assert.Equal(t, 200, statusResp.StatusCode)

		var status TOTPStatusResponse
		require.NoError(t, statusResp.GetJSON(&status))
		assert.False(t, status.Enabled)
	})

	t.Run("session auth can access servers endpoint", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		user := &e2etesting.TestUser{
			Username: "sessionauthuser3",
			Email:    "sessionauthuser3@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		serversResp, err := sessionClient.Get("/api/v1/servers")
		require.NoError(t, err)
		assert.Equal(t, 200, serversResp.StatusCode)

		var serversResponse struct {
			Servers []struct {
				ID   uint   `json:"id"`
				Name string `json:"name"`
			} `json:"servers"`
		}
		require.NoError(t, serversResp.GetJSON(&serversResponse))

	})

	t.Run("no auth returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/profile")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("invalid session cookie returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		clientWithCookie := app.HTTPClient.WithCookieJar()

		resp, err := clientWithCookie.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/profile",
			Cookies: []*http.Cookie{
				{
					Name:  "berth",
					Value: "invalid-session-token",
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestBothAuthMethodsWork(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "dualauthtestuser",
		Email:    "dualauthtestuser@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("profile endpoint via JWT", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
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
	})

	t.Run("profile endpoint via session cookie", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

		profileResp, err := sessionClient.Get("/api/v1/profile")
		require.NoError(t, err)
		assert.Equal(t, 200, profileResp.StatusCode)

		var profile handlers.GetProfileResponse
		require.NoError(t, profileResp.GetJSON(&profile))
		assert.Equal(t, user.Username, profile.Data.Username)
	})
}
