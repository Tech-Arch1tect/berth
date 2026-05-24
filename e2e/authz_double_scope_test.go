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

type doubleScopeFixture struct {
	userID   uint
	userJWT  string
	keyID    uint
	plainKey string
	roleID   uint
	serverID uint
}

func setupDoubleScopeFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
	serverID uint,
) doubleScopeFixture {
	t.Helper()

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "dscope-role-" + username,
		"description": "double-scope ceiling test role",
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
	require.NotZero(t, permID, "permission %q not found", permName)

	addPermResp, err := adminClient.Post(
		"/api/v1/admin/roles/"+Itoa(roleID)+"/stack-permissions",
		map[string]any{
			"server_id":     serverID,
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

	userJWT := app.AuthHelper.JWTLogin(t, username, "password123")

	userClient := app.HTTPClient.WithBearerToken(userJWT)

	createKeyResp, err := userClient.Post("/api/v1/api-keys", map[string]any{"name": "dscope-key-" + username})
	require.NoError(t, err)
	require.Equal(t, 201, createKeyResp.StatusCode, "create API key: %s", createKeyResp.GetString())

	var keyResult response.Response[apikey.CreateAPIKeyData]
	require.NoError(t, createKeyResp.GetJSON(&keyResult))
	keyID := keyResult.Data.APIKey.ID
	plainKey := keyResult.Data.PlainKey

	addScopeResp, err := userClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
		"server_id":     serverID,
		"stack_pattern": "*",
		"permission":    permName,
	})
	require.NoError(t, err)
	require.Equal(t, 201, addScopeResp.StatusCode, "add scope: %s", addScopeResp.GetString())

	return doubleScopeFixture{
		userID:   targetUser.ID,
		userJWT:  userJWT,
		keyID:    keyID,
		plainKey: plainKey,
		roleID:   roleID,
		serverID: serverID,
	}
}

func revokeRole(t *testing.T, adminClient *e2etesting.HTTPClient, userID, roleID uint) {
	t.Helper()
	resp, err := adminClient.Post("/api/v1/admin/users/revoke-role", map[string]any{
		"user_id": userID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode, "revoke-role: %s", resp.GetString())
}

func TestAuthzDoubleScope_StackRead(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "ds-sr-admin",
		Email:    "ds-sr-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "ds-sr-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "allowed-stack", "status": "running"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack", map[string]any{
		"name": "allowed-stack", "status": "running",
	})

	fix := setupDoubleScopeFixture(t, app, adminClient, "ds-sr-user", permnames.StacksRead, srv.ID)

	stackURL := "/api/v1/servers/" + Itoa(fix.serverID) + "/stacks/allowed-stack"

	t.Run("API key and JWT work before revocation", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "key should be admitted before revocation: %s", resp.GetString())

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "JWT should be admitted before revocation: %s", resp.GetString())
	})

	revokeRole(t, adminClient, fix.userID, fix.roleID)

	t.Run("API key is denied after owner loses stacks.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "key must be denied once owner loses permission: %s", resp.GetString())
	})

	t.Run("JWT is denied after user loses stacks.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "JWT must be denied once user loses permission: %s", resp.GetString())
	})
}

func TestAuthzDoubleScope_StackList(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "ds-sl-admin",
		Email:    "ds-sl-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "ds-sl-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "allowed-stack", "status": "running"},
	})

	fix := setupDoubleScopeFixture(t, app, adminClient, "ds-sl-user", permnames.StacksRead, srv.ID)

	listURL := "/api/v1/servers/" + Itoa(fix.serverID) + "/stacks"

	t.Run("API key and JWT work before revocation", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "key should be admitted before revocation: %s", resp.GetString())

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "JWT should be admitted before revocation: %s", resp.GetString())
	})

	revokeRole(t, adminClient, fix.userID, fix.roleID)

	t.Run("API key is denied after owner loses stacks.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "key must be denied once owner loses permission: %s", resp.GetString())
	})

	t.Run("JWT is denied after user loses stacks.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "JWT must be denied once user loses permission: %s", resp.GetString())
	})
}

func TestAuthzDoubleScope_FilesWrite(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "ds-fw-admin",
		Email:    "ds-fw-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "ds-fw-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/files/write", map[string]string{
		"message": "success",
	})

	fix := setupDoubleScopeFixture(t, app, adminClient, "ds-fw-user", permnames.FilesWrite, srv.ID)

	writeURL := "/api/v1/servers/" + Itoa(fix.serverID) + "/stacks/allowed-stack/files/write"
	writeBody := map[string]any{"path": "test.txt", "content": "hello"}

	t.Run("API key and JWT work before revocation", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    writeURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "key should not be 401 before revocation")
		assert.NotEqual(t, 403, resp.StatusCode, "key should be admitted before revocation: %s", resp.GetString())

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    writeURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode, "JWT should be admitted before revocation: %s", resp.GetString())
	})

	revokeRole(t, adminClient, fix.userID, fix.roleID)

	t.Run("API key is denied after owner loses files.write", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    writeURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "key must be denied once owner loses permission: %s", resp.GetString())
	})

	t.Run("JWT is denied after user loses files.write", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    writeURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
			Body:    writeBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "JWT must be denied once user loses permission: %s", resp.GetString())
	})
}

func TestAuthzDoubleScope_LogsRead(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "ds-lr-admin",
		Email:    "ds-lr-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "ds-lr-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/logs", map[string]any{
		"logs": []any{},
	})

	fix := setupDoubleScopeFixture(t, app, adminClient, "ds-lr-user", permnames.LogsRead, srv.ID)

	logsURL := "/api/v1/servers/" + Itoa(fix.serverID) + "/stacks/allowed-stack/logs"

	t.Run("API key and JWT are not forbidden before revocation", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    logsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "key should not be 401 before revocation")
		assert.NotEqual(t, 403, resp.StatusCode, "key should not be 403 before revocation: %s", resp.GetString())

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    logsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode, "JWT should not be 403 before revocation: %s", resp.GetString())
	})

	revokeRole(t, adminClient, fix.userID, fix.roleID)

	t.Run("API key is denied after owner loses logs.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    logsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "key must be denied once owner loses permission: %s", resp.GetString())
	})

	t.Run("JWT is denied after user loses logs.read", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    logsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "JWT must be denied once user loses permission: %s", resp.GetString())
	})
}

func TestAuthzDoubleScope_OperationsManage(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "ds-om-admin",
		Email:    "ds-om-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "ds-om-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/operations", map[string]any{
		"operationId": "test-op-id",
	})

	fix := setupDoubleScopeFixture(t, app, adminClient, "ds-om-user", permnames.StacksManage, srv.ID)

	opsURL := "/api/v1/servers/" + Itoa(fix.serverID) + "/stacks/allowed-stack/operations"
	opsBody := map[string]any{"command": "up"}

	t.Run("API key and JWT work before revocation", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
			Body:    opsBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "key should not be 401 before revocation")
		assert.NotEqual(t, 403, resp.StatusCode, "key should be admitted before revocation: %s", resp.GetString())

		resp, err = app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
			Body:    opsBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode, "JWT should be admitted before revocation: %s", resp.GetString())
	})

	revokeRole(t, adminClient, fix.userID, fix.roleID)

	t.Run("API key is denied after owner loses stacks.manage", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.plainKey},
			Body:    opsBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "key must be denied once owner loses permission: %s", resp.GetString())
	})

	t.Run("JWT is denied after user loses stacks.manage", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    opsURL,
			Headers: map[string]string{"Authorization": "Bearer " + fix.userJWT},
			Body:    opsBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "JWT must be denied once user loses permission: %s", resp.GetString())
	})
}
