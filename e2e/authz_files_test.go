package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/user"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type authzFilesFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzFilesFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
) (authzFilesFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-files-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/files", map[string]any{
		"path":    ".",
		"entries": []any{},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/files/write", map[string]string{
		"message": "success",
	})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-files-role-" + username,
		"description": "authz files test role",
	})
	require.NoError(t, err)
	require.Equal(t, 201, roleResp.StatusCode)

	var roleResult response.Response[user.RoleWithPermissions]
	require.NoError(t, roleResp.GetJSON(&roleResult))
	roleID := roleResult.Data.ID

	permsResp, err := adminClient.Get("/api/v1/admin/permissions")
	require.NoError(t, err)
	require.Equal(t, 200, permsResp.StatusCode)

	var permList response.Response[rbac.ListPermissionsData]
	require.NoError(t, permsResp.GetJSON(&permList))

	var permID uint
	for _, p := range permList.Data.Permissions {
		if p.Name == permName {
			permID = p.ID
			break
		}
	}
	require.NotZero(t, permID, "permission %q not found in permissions list", permName)

	addPermResp, err := adminClient.Post(
		"/api/v1/admin/roles/"+itoa(roleID)+"/stack-permissions",
		map[string]any{
			"server_id":     srv.ID,
			"permission_id": permID,
			"stack_pattern": "*",
		},
	)
	require.NoError(t, err)
	require.Equal(t, 201, addPermResp.StatusCode, "add stack-permission: %s", addPermResp.GetString())

	assignResp, err := adminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, assignResp.StatusCode, "assign role: %s", assignResp.GetString())

	jwt := app.AuthHelper.JWTLogin(t, username, "password123")
	return authzFilesFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func TestAuthzFiles_ReadRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-files-read-admin",
		Email:    "authz-files-read-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzFilesFixture(t, app, adminClient, "authz-fr-user", permnames.FilesRead)

	sid := itoa(fixture.serverID)
	listURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack/files"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(listURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with files.read is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("JWT without files.read returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-fr-noperm",
			Email:    "authz-fr-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-files-read-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     fixture.serverID,
			"stack_pattern": "allowed-*",
			"permission":    permnames.FilesRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-files-read-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzFiles_WriteRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-files-write-admin",
		Email:    "authz-files-write-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	writeFixture, _ := setupAuthzFilesFixture(t, app, adminClient, "authz-fw-user2", permnames.FilesWrite)
	readOnlyFixture, _ := setupAuthzFilesFixture(t, app, adminClient, "authz-fw-readonly2", permnames.FilesRead)

	writeBody := map[string]any{
		"path":    "test.txt",
		"content": "hello",
	}

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := itoa(writeFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + sid + "/stacks/allowed-stack/files/write",
			Body:   writeBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with files.write is admitted", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := itoa(writeFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/files/write",
			Headers: map[string]string{"Authorization": "Bearer " + writeFixture.jwt},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("JWT with files.read but not files.write returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := itoa(readOnlyFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/files/write",
			Headers: map[string]string{"Authorization": "Bearer " + readOnlyFixture.jwt},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := itoa(writeFixture.serverID)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-files-write-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     writeFixture.serverID,
			"stack_pattern": "allowed-*",
			"permission":    permnames.FilesWrite,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/files/write",
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := itoa(writeFixture.serverID)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-files-write-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/files/write",
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
