package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/rbac"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/user"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type authzImageUpdatesFixture struct {
	jwt           string
	serverInScope uint
	serverNoRole  uint
}

func setupAuthzImageUpdatesFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username string,
) authzImageUpdatesFixture {
	t.Helper()

	mockAgentIn, srvIn := app.CreateTestServerWithAgent(t, "authz-iu-in-"+username)
	mockAgentIn.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	mockAgentOut, srvOut := app.CreateTestServerWithAgent(t, "authz-iu-out-"+username)
	mockAgentOut.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-iu-role-" + username,
		"description": "authz image-updates test role",
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
		if p.Name == permnames.StacksRead {
			permID = p.ID
			break
		}
	}
	require.NotZero(t, permID, "permission stacks.read not found")

	addPermResp, err := adminClient.Post(
		"/api/v1/admin/roles/"+itoa(roleID)+"/stack-permissions",
		map[string]any{
			"server_id":     srvIn.ID,
			"permission_id": permID,
			"stack_pattern": "*",
		},
	)
	require.NoError(t, err)
	require.Equal(t, 201, addPermResp.StatusCode)

	assignResp, err := adminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, assignResp.StatusCode)

	jwt := app.AuthHelper.JWTLogin(t, username, "password123")
	return authzImageUpdatesFixture{
		jwt:           jwt,
		serverInScope: srvIn.ID,
		serverNoRole:  srvOut.ID,
	}
}

func seedImageUpdate(t *testing.T, app *TestApp, serverID uint, stackName, container string) {
	t.Helper()
	row := &imageupdates.ContainerImageUpdate{
		ServerID:         serverID,
		StackName:        stackName,
		ContainerName:    container,
		CurrentImageName: "nginx:1.25",
		UpdateAvailable:  true,
	}
	require.NoError(t, app.DB.Create(row).Error)
}

func TestAuthzImageUpdates_GlobalList(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-iu-g-admin",
		Email:    "authz-iu-g-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture := setupAuthzImageUpdatesFixture(t, app, adminClient, "authz-iu-g-user")

	seedImageUpdate(t, app, fixture.serverInScope, "in-scope-stack", "ctr-1")
	seedImageUpdate(t, app, fixture.serverNoRole, "out-of-scope-stack", "ctr-2")

	listURL := "/api/v1/image-updates"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(listURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT returns 200 with only in-scope updates", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		var got response.Response[imageupdates.ImageUpdatesData]
		require.NoError(t, resp.GetJSON(&got))

		require.Len(t, got.Data.Updates, 1)
		assert.Equal(t, fixture.serverInScope, got.Data.Updates[0].ServerID)
		assert.Equal(t, "in-scope-stack", got.Data.Updates[0].StackName)
	})

	t.Run("JWT with no roles returns 200 with empty list", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noRoleUser := &e2etesting.TestUser{
			Username: "authz-iu-g-norole",
			Email:    "authz-iu-g-norole@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noRoleUser)
		noRoleJWT := app.AuthHelper.JWTLogin(t, noRoleUser.Username, noRoleUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    listURL,
			Headers: map[string]string{"Authorization": "Bearer " + noRoleJWT},
		})
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		var got response.Response[imageupdates.ImageUpdatesData]
		require.NoError(t, resp.GetJSON(&got))
		assert.Empty(t, got.Data.Updates)
	})
}

func TestAuthzImageUpdates_ServerScopedList(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-iu-s-admin",
		Email:    "authz-iu-s-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture := setupAuthzImageUpdatesFixture(t, app, adminClient, "authz-iu-s-user")

	seedImageUpdate(t, app, fixture.serverInScope, "in-scope-stack", "ctr-1")

	inURL := "/api/v1/servers/" + itoa(fixture.serverInScope) + "/image-updates"
	outURL := "/api/v1/servers/" + itoa(fixture.serverNoRole) + "/image-updates"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(inURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT without role on the server returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    outURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("JWT with role on the server returns 200 with updates", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    inURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		var got response.Response[imageupdates.ImageUpdatesData]
		require.NoError(t, resp.GetJSON(&got))
		require.Len(t, got.Data.Updates, 1)
		assert.Equal(t, "in-scope-stack", got.Data.Updates[0].StackName)
	})

	t.Run("API key without server scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/image-updates", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-iu-s-key-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    inURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
