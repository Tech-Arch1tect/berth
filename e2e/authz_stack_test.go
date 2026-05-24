package e2e

import (
	"net/http"
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

type authzStackFixture struct {
	jwt      string
	serverID uint
}

func setupAuthzStackFixture(
	t *testing.T,
	app *TestApp,
	adminClient *e2etesting.HTTPClient,
	username, permName, stackPattern string,
) (authzStackFixture, *MockAgent) {
	t.Helper()

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-stack-"+username)
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{
		{"name": "allowed-stack", "status": "running"},
		{"name": "other-stack", "status": "running"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack", map[string]any{
		"name": "allowed-stack", "status": "running",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/networks", []map[string]any{})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/volumes", []map[string]any{})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/environment", map[string]any{})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/images", []map[string]any{})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/stats", map[string]any{
		"stack_name": "allowed-stack", "containers": []any{},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/compose", map[string]any{
		"content": "version: '3'\nservices: {}\n",
	})

	targetUser := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, targetUser)

	roleResp, err := adminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        "authz-role-" + username,
		"description": "authz test role",
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
			"stack_pattern": stackPattern,
		},
	)
	require.NoError(t, err)
	require.Equal(t, 201, addPermResp.StatusCode, "add stack-permission: %s", addPermResp.GetString())

	GrantStacksReadPrerequisite(t, adminClient, roleID, srv.ID, stackPattern, permName, permList.Data.Permissions)

	assignResp, err := adminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(t, err)
	require.Equal(t, 200, assignResp.StatusCode, "assign role: %s", assignResp.GetString())

	jwt := app.AuthHelper.JWTLogin(t, username, "password123")
	return authzStackFixture{jwt: jwt, serverID: srv.ID}, mockAgent
}

func TestAuthzStack_StackRead(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-stack-read-admin",
		Email:    "authz-stack-read-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	fixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-sr-user", permnames.StacksRead, "*")

	sid := Itoa(fixture.serverID)
	stackURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack"

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Get(stackURL)
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("JWT with stacks.read on stack is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + fixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("JWT without any stack permission returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		noPermUser := &e2etesting.TestUser{
			Username: "authz-sr-noperm",
			Email:    "authz-sr-noperm@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, noPermUser)
		noPermJWT := app.AuthHelper.JWTLogin(t, noPermUser.Username, noPermUser.Password)

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + noPermJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("API key in scope is admitted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-stack-read-key"})
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
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("API key out of scope returns 403", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": "authz-stack-read-noscope"})
		require.NoError(t, err)
		var keyResult response.Response[apikey.CreateAPIKeyData]
		require.NoError(t, createResp.GetJSON(&keyResult))
		plainKey := keyResult.Data.PlainKey

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    stackURL,
			Headers: map[string]string{"Authorization": "Bearer " + plainKey},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestAuthzStack_ComposeWrite(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-compose-admin",
		Email:    "authz-compose-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	writeFixture, mockAgent := setupAuthzStackFixture(t, app, adminClient, "authz-fw-user", permnames.FilesWrite, "*")
	mockAgent.RegisterJSONHandler("/api/stacks/allowed-stack/compose", map[string]any{
		"content": "version: '3'\nservices: {}\n",
	})

	readOnlyFixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-fw-readonly", permnames.StacksRead, "*")

	sid := Itoa(writeFixture.serverID)
	patchURL := "/api/v1/servers/" + sid + "/stacks/allowed-stack/compose"

	patchBody := map[string]any{
		"changes": map[string]any{
			"add_services": map[string]any{
				"web": map[string]any{"image": "nginx:latest"},
			},
		},
	}

	t.Run("JWT with files.write is admitted on PATCH compose", func(t *testing.T) {
		TagTest(t, "PATCH", "/api/v1/servers/:serverid/stacks/:stackname/compose", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "PATCH",
			Path:    patchURL,
			Headers: map[string]string{"Authorization": "Bearer " + writeFixture.jwt},
			Body:    patchBody,
		})
		require.NoError(t, err)
		assert.NotEqual(t, 403, resp.StatusCode, "files.write should be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 401, resp.StatusCode)
	})

	t.Run("JWT with stacks.read but not files.write returns 403 on PATCH compose", func(t *testing.T) {
		TagTest(t, "PATCH", "/api/v1/servers/:serverid/stacks/:stackname/compose", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

		sid2 := Itoa(readOnlyFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "PATCH",
			Path:    "/api/v1/servers/" + sid2 + "/stacks/allowed-stack/compose",
			Headers: map[string]string{"Authorization": "Bearer " + readOnlyFixture.jwt},
			Body:    patchBody,
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "stacks.read-only should be 403 on PATCH compose")
	})
}

func TestAuthzStack_ComposeRead(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-composeget-admin",
		Email:    "authz-composeget-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	readFixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-fr-user", permnames.FilesRead, "*")
	noFilesFixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-fr-nofiles", permnames.StacksRead, "*")

	t.Run("JWT with files.read is admitted on GET compose", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/compose", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := Itoa(readFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/compose",
			Headers: map[string]string{"Authorization": "Bearer " + readFixture.jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 403, resp.StatusCode, "files.read admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 401, resp.StatusCode)
	})

	t.Run("JWT with stacks.read but not files.read returns 403 on GET compose", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/compose", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := Itoa(noFilesFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/servers/" + sid + "/stacks/allowed-stack/compose",
			Headers: map[string]string{"Authorization": "Bearer " + noFilesFixture.jwt},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "stacks.read-only should be 403 on GET compose")
	})
}

func TestAuthzStack_CreateStack(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-create-admin",
		Email:    "authz-create-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	matchFixture, mockAgent := setupAuthzStackFixture(t, app, adminClient, "authz-create-match", permnames.StacksCreate, "allowed-*")
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})
	mockAgent.RegisterHandler("/api/stacks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(201)
			_, _ = w.Write([]byte(`{"success":true,"stack":{"name":"allowed-new","status":"running"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	})

	noMatchFixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-create-nomatch", permnames.StacksCreate, "allowed-*")

	t.Run("JWT with matching pattern is admitted on POST stacks", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := Itoa(matchFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks",
			Headers: map[string]string{"Authorization": "Bearer " + matchFixture.jwt},
			Body:    map[string]any{"name": "allowed-new"},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 403, resp.StatusCode, "matching pattern must be admitted; got %d: %s", resp.StatusCode, resp.GetString())
		assert.NotEqual(t, 401, resp.StatusCode)
	})

	t.Run("JWT whose pattern does not match requested name returns 403", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		sid := Itoa(noMatchFixture.serverID)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "POST",
			Path:    "/api/v1/servers/" + sid + "/stacks",
			Headers: map[string]string{"Authorization": "Bearer " + noMatchFixture.jwt},
			Body:    map[string]any{"name": "disallowed-stack"},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode, "non-matching pattern must be 403; got %d: %s", resp.StatusCode, resp.GetString())
	})
}

func TestAuthzStack_Authenticated(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	plain := &e2etesting.TestUser{
		Username: "authz-auth-plain",
		Email:    "authz-auth-plain@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, plain)
	jwt := app.AuthHelper.JWTLogin(t, plain.Username, plain.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-auth-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	sid := Itoa(srv.ID)

	t.Run("can-create admits any authenticated user", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/can-create", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/servers/" + sid + "/stacks/can-create",
			Headers: map[string]string{"Authorization": "Bearer " + jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("permissions admits any authenticated user", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/permissions", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/servers/" + sid + "/stacks/some-stack/permissions",
			Headers: map[string]string{"Authorization": "Bearer " + jwt},
		})
		require.NoError(t, err)
		assert.NotEqual(t, 401, resp.StatusCode)
		assert.NotEqual(t, 403, resp.StatusCode)
	})

	t.Run("unauthenticated returns 401 on can-create", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks/can-create", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Get("/api/v1/servers/" + sid + "/stacks/can-create")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestAuthzStack_ServerGate(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "authz-sg-admin",
		Email:    "authz-sg-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)
	adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)

	mockAgent, srv := app.CreateTestServerWithAgent(t, "authz-sg-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})

	noAccessUser := &e2etesting.TestUser{
		Username: "authz-sg-noaccess",
		Email:    "authz-sg-noaccess@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, noAccessUser)
	noAccessJWT := app.AuthHelper.JWTLogin(t, noAccessUser.Username, noAccessUser.Password)

	fixture, _ := setupAuthzStackFixture(t, app, adminClient, "authz-sg-user", permnames.StacksRead, "*")
	_ = fixture

	sid := Itoa(srv.ID)

	t.Run("principal with no server access returns 403 on list stacks", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/stacks", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  "GET",
			Path:    "/api/v1/servers/" + sid + "/stacks",
			Headers: map[string]string{"Authorization": "Bearer " + noAccessJWT},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
