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

type authzOpsFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzOpsFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
) (authzOpsFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-ops-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/operations", map[string]any{
		"operationId": "test-op-id",
	})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-ops-role-" + username,
		"description": "authz ops test role",
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
	return authzOpsFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func TestAuthzOperations_Unauthenticated(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-ops-unauth-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	sid := itoa(srv.ID)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + sid + "/stacks/allowed-stack/operations",
			Body:   map[string]any{"command": "up"},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestAuthzOperations_StacksManage(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-ops-sm-admin",
		Email:    "authz-ops-sm-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	manageFixture, _ := setupAuthzOpsFixture(t, app, adminClient, "authz-ops-sm-user", permnames.StacksManage)

	sid := itoa(manageFixture.serverID)
	opsURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack/operations"

	t.Run("JWT with stacks.manage is admitted for non-archive command", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + manageFixture.jwt},
			Body:    map[string]any{"command": "up"},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "stacks.manage should be admitted for 'up'; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "stacks.manage should be admitted for 'up'; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT with stacks.manage but not files.write returns 403 for create-archive", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + manageFixture.jwt},
			Body:    map[string]any{"command": "create-archive"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "create-archive requires files.write, not stacks.manage; got %d: %s", resp.StatusCode, resp.GetString())
	})
}

func TestAuthzOperations_FilesWrite(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-ops-fw-admin",
		Email:    "authz-ops-fw-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	filesFixture, _ := setupAuthzOpsFixture(t, app, adminClient, "authz-ops-fw-user", permnames.FilesWrite)

	sid := itoa(filesFixture.serverID)
	opsURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack/operations"

	t.Run("JWT with files.write is admitted for create-archive", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + filesFixture.jwt},
			Body:    map[string]any{"command": "create-archive"},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "files.write should be admitted for 'create-archive'; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "files.write should be admitted for 'create-archive'; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT with files.write but not stacks.manage returns 403 for up", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + filesFixture.jwt},
			Body:    map[string]any{"command": "up"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "'up' requires stacks.manage, not files.write; got %d: %s", resp.StatusCode, resp.GetString())
	})
}

func TestAuthzOperations_APIKey(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-ops-ak-admin",
		Email:    "authz-ops-ak-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	manageFixture, _ := setupAuthzOpsFixture(t, app, adminClient, "authz-ops-ak-manage", permnames.StacksManage)

	sid := itoa(manageFixture.serverID)
	opsURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack/operations"

	t.Run("API key with stacks.manage scope is admitted for non-archive command", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-ops-manage-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     manageFixture.serverID,
			"stack_pattern": "allowed-*",
			"permission":    permnames.StacksManage,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    map[string]any{"command": "up"},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "API key with stacks.manage scope admitted for 'up'; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "API key with stacks.manage scope admitted for 'up'; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-ops-noscope-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    map[string]any{"command": "up"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "API key without scope should be 403; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("API key with files.write scope is admitted for create-archive", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		filesFixture, _ := setupAuthzOpsFixture(t, app, adminClient, "authz-ops-ak-fw", permnames.FilesWrite)
		fwSid := itoa(filesFixture.serverID)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-ops-fw-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     filesFixture.serverID,
			"stack_pattern": "allowed-*",
			"permission":    permnames.FilesWrite,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + fwSid + "/stacks/allowed-stack/operations",
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    map[string]any{"command": "create-archive"},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "API key with files.write scope admitted for 'create-archive'; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "API key with files.write scope admitted for 'create-archive'; got %d: %s", resp.StatusCode, resp.GetString())
	})
}
