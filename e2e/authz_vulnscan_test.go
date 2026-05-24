package e2e

import (
	"testing"
	"time"

	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/user"
	"berth/internal/domain/vulnscan"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type authzVulnscanFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzVulnscanFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName string,
) (authzVulnscanFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-vs-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-vs-role-" + username,
		"description": "authz vulnscan test role",
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

	assignResp, err := adminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, assignResp.StatusCode, "assign role: %s", assignResp.GetString())

	jwt := app.AuthHelper.JWTLogin(t, username, "password123")
	return authzVulnscanFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func createTestScan(t *testing.T, app *TestApp, serverID uint, stackName string) *vulnscan.ImageScan {
	t.Helper()
	scan := &vulnscan.ImageScan{
		ServerID:  serverID,
		StackName: stackName,
		Status:    vulnscan.ScanStatusCompleted,
		StartedAt: time.Now(),
	}
	err := app.DB.Create(scan).Error
	require.NoError(t, err, "failed to create test scan")
	return scan
}

func TestAuthzVulnscan_StackPath(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-vs-sp-admin",
		Email:    "authz-vs-sp-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzVulnscanFixture(t, app, adminClient, "authz-vs-sp-user", permnames.StacksRead)

	sid := Itoa(fixture.serverID)
	url := "/api/v1/servers/" + sid + "/stacks/allowed-stack/vulnscan"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(url)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with stacks.read is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "stacks.read should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "stacks.read should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT without permission returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-vs-sp-noperm",
			Email:    "authz-vs-sp-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-vs-sp-key"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		keyID := keyResult.Data.APIKey.ID
		plainKey := keyResult.Data.PlainKey

		addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
			"server_id":     fixture.serverID,
			"stack_pattern": "allowed-*",
			"permission":    permnames.StacksRead,
		})
		require.NoError(t, err)
		require.Equal(t, 201, addScopeResp.StatusCode)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "API key in scope should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "API key in scope should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-vs-sp-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    url,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzVulnscan_ScanByID(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-vs-sid-admin",
		Email:    "authz-vs-sid-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzVulnscanFixture(t, app, adminClient, "authz-vs-sid-user", permnames.StacksRead)

	scan := createTestScan(t, app, fixture.serverID, "allowed-stack")
	scanURL := "/api/v1/vulnscan/" + Itoa(scan.ID)

	t.Run("JWT with stacks.read on scan stack is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/:scanid", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    scanURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "stacks.read should be admitted for scan's stack; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "stacks.read should be admitted for scan's stack; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT without permission returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/:scanid", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-vs-sid-noperm",
			Email:    "authz-vs-sid-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    scanURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("non-existent scan id returns 404", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/:scanid", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/vulnscan/999999999",
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestAuthzVulnscan_Compare(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-vs-cmp-admin",
		Email:    "authz-vs-cmp-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzVulnscanFixture(t, app, adminClient, "authz-vs-cmp-user", permnames.StacksRead)

	baseScan := createTestScan(t, app, fixture.serverID, "allowed-stack")
	compareScan := createTestScan(t, app, fixture.serverID, "allowed-stack")

	compareURL := "/api/v1/vulnscan/compare/" + Itoa(baseScan.ID) + "/" + Itoa(compareScan.ID)

	t.Run("JWT authorised for both scans' stacks is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/compare/:baseScanId/:compareScanId", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    compareURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode, "authorised principal should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 403, resp.StatusCode, "authorised principal should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
	})

	t.Run("JWT without permission returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/compare/:baseScanId/:compareScanId", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-vs-cmp-noperm",
			Email:    "authz-vs-cmp-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    compareURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("principal authorised for only one stack returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/vulnscan/compare/:baseScanId/:compareScanId", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		_, otherSrv := app.CreateTestServerWithAgent(t, "authz-vs-cmp-other")
		otherScan := createTestScan(t, app, otherSrv.ID, "other-stack")

		crossURL := "/api/v1/vulnscan/compare/" + Itoa(baseScan.ID) + "/" + Itoa(otherScan.ID)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    crossURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "principal with access only to base scan's stack must be 403; got %d: %s", resp.StatusCode, resp.GetString())
	})
}
