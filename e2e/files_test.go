package e2e

import (
	"testing"

	"berth/handlers"
	"berth/internal/files"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

func TestFileEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "filesjwtuser",
		Email:    "filesjwtuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-files")

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files", map[string]interface{}{
		"path": ".",
		"entries": []map[string]interface{}{
			{
				"name":         "docker-compose.yml",
				"path":         "docker-compose.yml",
				"size":         1234,
				"is_directory": false,
				"mode":         "-rw-r--r--",
			},
			{
				"name":         "config",
				"path":         "config",
				"size":         4096,
				"is_directory": true,
				"mode":         "drwxr-xr-x",
			},
		},
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/read", map[string]interface{}{
		"path":     "docker-compose.yml",
		"content":  "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
		"size":     52,
		"encoding": "utf-8",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/write", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/mkdir", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/delete", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/rename", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/copy", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/chmod", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/chown", map[string]string{
		"message": "success",
	})

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/stats", map[string]interface{}{
		"path":              ".",
		"most_common_owner": 1000,
		"most_common_group": 1000,
		"most_common_mode":  "0644",
		"owner_name":        "appuser",
		"group_name":        "appgroup",
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files returns directory listing", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var listing files.DirectoryListingResponse
		require.NoError(t, resp.GetJSON(&listing))
		assert.True(t, listing.Success)
		assert.Equal(t, ".", listing.Data.Path)
		assert.NotEmpty(t, listing.Data.Entries)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/read returns file content", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/read", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/read?filePath=docker-compose.yml",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var content files.FileContentResponse
		require.NoError(t, resp.GetJSON(&content))
		assert.True(t, content.Success)
		assert.Equal(t, "docker-compose.yml", content.Data.Path)
		assert.NotEmpty(t, content.Data.Content)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/read without filePath returns 400", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/read", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/read",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/write creates file", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/write",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"path":    "test.txt",
				"content": "Hello World",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/mkdir creates directory", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/mkdir", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/mkdir",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"path": "new-dir",
				"mode": "0755",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/stacks/:stackname/files/delete removes file", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/stacks/:stackname/files/delete", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/delete",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"path": "old-file.txt",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/rename moves file", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/rename", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/rename",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"old_path": "config.yml",
				"new_path": "config.yml.bak",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/copy copies file", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/copy", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/copy",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"source_path": "docker-compose.yml",
				"target_path": "docker-compose.yml.backup",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/chmod changes permissions", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/chmod", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/chmod",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"path":      "script.sh",
				"mode":      "0755",
				"recursive": false,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/chown changes ownership", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/chown", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/chown",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"path":      "data/",
				"owner_id":  1000,
				"group_id":  1000,
				"recursive": true,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/stats returns directory stats", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/stats", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stats files.DirectoryStatsResponse
		require.NoError(t, resp.GetJSON(&stats))
		assert.True(t, stats.Success)
		assert.Equal(t, ".", stats.Data.Path)
	})
}

func TestFileEndpointsSessionAuth(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "filessessionuser",
		Email:    "filessessionuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-files-session")

	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files", map[string]interface{}{
		"path":    ".",
		"entries": []map[string]interface{}{},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files/delete", map[string]string{
		"message": "File deleted successfully",
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files works with session auth", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/stacks/:stackname/files/delete works with session auth", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/stacks/:stackname/files/delete", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.DeleteWithBody("/api/v1/servers/"+itoa(testServer.ID)+"/stacks/test-stack/files/delete", map[string]interface{}{
			"path": "test-file.txt",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestFileEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-files-noauth")
	mockAgent.RegisterJSONHandler("/api/stacks/test-stack/files", map[string]interface{}{})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers/" + itoa(testServer.ID) + "/stacks/test-stack/files")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/stacks/:stackname/files/delete requires authentication", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/stacks/:stackname/files/delete", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.DeleteWithBody("/api/v1/servers/"+itoa(testServer.ID)+"/stacks/test-stack/files/delete", map[string]interface{}{
			"path": "test-file.txt",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

}
