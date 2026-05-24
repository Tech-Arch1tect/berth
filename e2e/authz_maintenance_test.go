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

type authzMaintenanceFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzMaintenanceFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
) (authzMaintenanceFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-maint-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/info", map[string]any{})
	mockAgent.RegisterJSONHandler("/api/maintenance/prune", map[string]any{
		"containers_deleted":    []any{},
		"images_deleted":        []any{},
		"networks_deleted":      []any{},
		"volumes_deleted":       []any{},
		"build_cache_deleted":   []any{},
		"space_reclaimed_bytes": 0,
	})
	mockAgent.RegisterJSONHandler("/api/maintenance/resource", map[string]any{
		"resource_type": "container",
		"resource_id":   "test-resource",
		"deleted":       true,
	})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-maint-role-" + username,
		"description": "authz maintenance test role",
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
		"/api/v1/admin/roles/"+Itoa(roleID)+"/stack-permissions",
		map[string]any{
			"server_id":     srv.ID,
			"permission_id": permID,
			"stack_pattern": "*",
		},
	)
	require.NoError(t, err)
	require.Equal(t, 201, addPermResp.StatusCode, "add stack-permission: %s", addPermResp.GetString())

	GrantStacksReadPrerequisite(t, adminClient, roleID, srv.ID, "*", permName, permList.Data.Permissions)

	assignResp, err := adminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, assignResp.StatusCode, "assign role: %s", assignResp.GetString())

	jwt := app.AuthHelper.JWTLogin(t, username, "password123")
	return authzMaintenanceFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func TestAuthzMaintenance_ReadRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-maint-r-admin",
		Email:    "authz-maint-r-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzMaintenanceFixture(t, app, adminClient, "authz-maint-r-user", permnames.DockerMaintenanceRead)

	sid := Itoa(fixture.serverID)
	infoURL := "/api/v1/servers/" + sid + "/maintenance/info"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(infoURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with docker.maintenance.read is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    infoURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("JWT without docker.maintenance.read returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-maint-r-noperm",
			Email:    "authz-maint-r-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    infoURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-maint-read-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"server_id":     fixture.serverID,
			"stack_pattern": "*",
			"permission":    permnames.DockerMaintenanceRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		AddAPIKeyStacksReadScope(t, adminClient, keyID, fixture.serverID, "*", permnames.DockerMaintenanceRead)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    infoURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-maint-read-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    infoURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzMaintenance_WriteRoute(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-maint-w-admin",
		Email:    "authz-maint-w-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzMaintenanceFixture(t, app, adminClient, "authz-maint-w-user", permnames.DockerMaintenanceWrite)

	sid := Itoa(fixture.serverID)
	pruneURL := "/api/v1/servers/" + sid + "/maintenance/prune"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   pruneURL,
			Body:   map[string]any{"type": "images"},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with docker.maintenance.write is admitted", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    pruneURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
			Body:    map[string]any{"type": "images"},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("JWT without docker.maintenance.write returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-maint-w-noperm",
			Email:    "authz-maint-w-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    pruneURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
			Body:    map[string]any{"type": "images"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-maint-write-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"server_id":     fixture.serverID,
			"stack_pattern": "*",
			"permission":    permnames.DockerMaintenanceWrite,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		AddAPIKeyStacksReadScope(t, adminClient, keyID, fixture.serverID, "*", permnames.DockerMaintenanceWrite)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    pruneURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    map[string]any{"type": "images"},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-maint-write-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    pruneURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
			Body:    map[string]any{"type": "images"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzMaintenance_PermissionsProbe(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-maint-pp-admin",
		Email:    "authz-maint-pp-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)

	_, srv := app.CreateTestServerWithAgent(t, "authz-maint-pp-server")

	sid := Itoa(srv.ID)
	permissionsURL := "/api/v1/servers/" + sid + "/maintenance/permissions"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(permissionsURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("any authenticated user is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		plainUser := &e2etesting.TestUser{
			Username: "authz-maint-pp-plain",
			Email:    "authz-maint-pp-plain@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, plainUser)
		plainJWT := app.AuthHelper.JWTLogin(t, plainUser.Username, plainUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    permissionsURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	})
}
