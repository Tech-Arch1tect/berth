package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type ImageUpdatesResponse struct {
	Updates []ImageUpdateEntry `json:"updates"`
}

type ImageUpdateEntry struct {
	ID                uint    `json:"id"`
	ServerID          uint    `json:"server_id"`
	StackName         string  `json:"stack_name"`
	ContainerName     string  `json:"container_name"`
	CurrentImageName  string  `json:"current_image_name"`
	CurrentRepoDigest string  `json:"current_repo_digest"`
	LatestRepoDigest  string  `json:"latest_repo_digest"`
	UpdateAvailable   bool    `json:"update_available"`
	LastCheckedAt     *string `json:"last_checked_at"`
	CheckError        string  `json:"check_error"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

func TestImageUpdatesNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/image-updates redirects to login when unauthenticated", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Get("/api/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})

	t.Run("GET /api/servers/:id/image-updates redirects to login when unauthenticated", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Get("/api/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
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

	t.Run("GET /api/image-updates returns empty list when no updates", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var result ImageUpdatesResponse
		require.NoError(t, resp.GetJSON(&result))
		assert.NotNil(t, result.Updates)
	})

	t.Run("GET /api/servers/1/image-updates returns 403 when server doesn't exist", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("GET /api/servers/invalid/image-updates returns 400 for invalid server ID", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/invalid/image-updates")
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

	t.Run("GET /api/image-updates returns 200 for user without server access", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/servers/1/image-updates returns 403 for user without server access", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/1/image-updates")
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
