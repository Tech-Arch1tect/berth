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

type authzRegistryFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzRegistryFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
) (authzRegistryFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-reg-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-reg-role-" + username,
		"description": "authz registry test role",
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
	return authzRegistryFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func TestAuthzRegistry_ListCredentials(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-reg-l-admin",
		Email:    "authz-reg-l-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzRegistryFixture(t, app, adminClient, "authz-reg-l-user", permnames.RegistriesManage)

	sid := itoa(fixture.serverID)
	listURL := "/api/v1/servers/" + sid + "/registries"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(listURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with registries.manage is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "registries.manage should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "registries.manage should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT without registries.manage returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-reg-l-noperm",
			Email:    "authz-reg-l-noperm@example.com",
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
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-reg-manage-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
			"server_id":     fixture.serverID,
			"stack_pattern": "*",
			"permission":    permnames.RegistriesManage,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "API key in scope should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "API key in scope should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-reg-manage-noscope"})
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
