package e2e

import (
	"testing"

	"berth/internal/imageupdates"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestImageUpdatesNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/image-updates requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:id/image-updates requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/image-updates", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestImageUpdatesWithAuth(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "imageupdateuser",
		Email:    "imageupdateuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /api/v1/image-updates returns empty list when no updates", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result imageupdates.ImageUpdatesResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.True(t, result.Success)
		assert.NotNil(t, result.Data.Updates)
	})

	t.Run("GET /api/v1/servers/1/image-updates returns 403 when server doesn't exist", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/image-updates", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/invalid/image-updates returns 400 for invalid server ID", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/image-updates", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/invalid/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestImageUpdatesNonAdmin(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "regularuser",
		Email:    "regularuser@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /api/v1/image-updates returns 200 for user without server access", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/1/image-updates returns 403 for user without server access", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:id/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
