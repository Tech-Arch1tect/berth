package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/maintenance"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func registerMaintenanceAgentEndpoints(agent *e2e.MockAgent) {
	agent.RegisterJSONHandler("/api/maintenance/info", map[string]any{})
	agent.RegisterJSONHandler("/api/maintenance/prune", map[string]any{
		"containers_deleted":    []any{},
		"images_deleted":        []any{},
		"networks_deleted":      []any{},
		"volumes_deleted":       []any{},
		"build_cache_deleted":   []any{},
		"space_reclaimed_bytes": 0,
	})
	agent.RegisterJSONHandler("/api/maintenance/resource", map[string]any{
		"resource_type": "container",
		"resource_id":   "test-resource",
		"deleted":       true,
	})
}

func TestAuthzMaintenanceInfo(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerMaintenanceAgentEndpoints(f.Agent)

	sid := e2e.Itoa(f.Server.ID)
	infoURL := "/api/v1/servers/" + sid + "/maintenance/info"

	otherServer, otherAgent := f.AddServer("other-srv")
	registerMaintenanceAgentEndpoints(otherAgent)
	otherInfoURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID) + "/maintenance/info"

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.DockerMaintenanceRead, "*")
	_, jwtOtherServer, _ := f.UserWithRole("other-server-reader", otherServer, permnames.DockerMaintenanceRead, "*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "*")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.DockerMaintenanceRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.DockerMaintenanceRead, "*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.DockerMaintenanceRead, "*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.DockerMaintenanceRead, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.DockerMaintenanceRead, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, "", 401)
	})
	t.Run("JWT with docker.maintenance.read on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT with docker.maintenance.read on a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(jwtOtherServer), 403)
	})
	t.Run("JWT with only stacks.read returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(jwtStacksOnly), 403)
	})
	t.Run("JWT with multi-role union admits each server in the union", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherInfoURL}, bearer(jwtUnion), 200)
	})
	t.Run("JWT admin is admitted on any server", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherInfoURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with matching scope on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(keyMatching), 200)
	})
	t.Run("API key scoped to a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with only stacks.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.DockerMaintenanceRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.DockerMaintenanceRead, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: infoURL}, bearer(key), 403)
	})
}

func TestAuthzMaintenancePrune(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerMaintenanceAgentEndpoints(f.Agent)

	sid := e2e.Itoa(f.Server.ID)
	pruneURL := "/api/v1/servers/" + sid + "/maintenance/prune"

	otherServer, otherAgent := f.AddServer("other-srv")
	registerMaintenanceAgentEndpoints(otherAgent)
	otherPruneURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID) + "/maintenance/prune"

	body := map[string]any{"type": "images"}

	assertNoPrune := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/maintenance/prune")
	}

	_, jwtWriter, _ := f.UserWithRole("writer", f.Server, permnames.DockerMaintenanceWrite, "*")
	_, jwtOtherServer, _ := f.UserWithRole("other-server-writer", otherServer, permnames.DockerMaintenanceWrite, "*")
	_, jwtReadOnly, _ := f.UserWithRole("read-only", f.Server, permnames.DockerMaintenanceRead, "*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "*")
	_, jwtAdmin := f.Admin("write-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceWrite, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.DockerMaintenanceWrite, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.DockerMaintenanceWrite, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.DockerMaintenanceWrite, "*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.DockerMaintenanceWrite, "*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceWrite, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.DockerMaintenanceWrite, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.DockerMaintenanceWrite, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.DockerMaintenanceWrite, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, "", 401)
		assertNoPrune(t)
	})
	t.Run("JWT with docker.maintenance.write on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtWriter), 200)
	})
	t.Run("JWT with docker.maintenance.write on a different server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtOtherServer), 403)
		assertNoPrune(t)
	})
	t.Run("JWT with docker.maintenance.read but not .write returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtReadOnly), 403)
		assertNoPrune(t)
	})
	t.Run("JWT with only stacks.read returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtStacksOnly), 403)
		assertNoPrune(t)
	})
	t.Run("JWT with multi-role union admits each server in the union", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: otherPruneURL, Body: body}, bearer(jwtUnion), 200)
	})
	t.Run("JWT admin is admitted on any server", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: otherPruneURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(keyNoScope), 403)
		assertNoPrune(t)
	})
	t.Run("API key with matching scope on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key scoped to a different server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(keyWrongServer), 403)
		assertNoPrune(t)
	})
	t.Run("API key with only stacks.read scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoPrune(t)
	})
	t.Run("API key (admin owner) without matching scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(keyAdminNoScope), 403)
		assertNoPrune(t)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.DockerMaintenanceWrite, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.DockerMaintenanceWrite, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: pruneURL, Body: body}, bearer(key), 403)
		assertNoPrune(t)
	})
}

func TestAuthzMaintenanceDeleteResource(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerMaintenanceAgentEndpoints(f.Agent)

	sid := e2e.Itoa(f.Server.ID)
	resourceURL := "/api/v1/servers/" + sid + "/maintenance/resource"

	body := map[string]any{"type": "container", "id": "test-resource"}

	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.DockerMaintenanceWrite, "*")
	_, jwtNoPerm := f.User("no-perm")

	assertNoDelete := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodDelete, "/maintenance/resource")
	}

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: resourceURL, Body: body}, "", 401)
		assertNoDelete(t)
	})
	t.Run("JWT with docker.maintenance.write is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: resourceURL, Body: body}, bearer(jwt), 200)
	})
	t.Run("JWT without docker.maintenance.write returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: resourceURL, Body: body}, bearer(jwtNoPerm), 403)
		assertNoDelete(t)
	})
}

func TestAuthzMaintenancePermissionsProbe(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	url := "/api/v1/servers/" + sid + "/maintenance/permissions"

	_, jwt := f.User("probe")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, "", 401)
	})
	t.Run("any authenticated user is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwt), 200)
	})
}

func TestAuthzMaintenancePermissionsProbeBody(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	probeURL := "/api/v1/servers/" + sid + "/maintenance/permissions"

	owner, jwtOwner := f.UserWithRoles("rw-owner", []RoleSpec{
		{Name: "rw", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.DockerMaintenanceWrite, StackPattern: "*"},
		}},
	})
	keyReadOnly := f.APIKeyFor(owner, "read-scope-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.DockerMaintenanceRead, "*"),
	})
	keyNoScope := f.APIKeyFor(owner, "noscope-key", nil)

	_, jwtReadOnly := f.UserWithRoles("read-owner", []RoleSpec{
		{Name: "ro", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.DockerMaintenanceRead, StackPattern: "*"},
		}},
	})
	_, jwtNoRole := f.User("roleless")

	t.Run("JWT with read and write sees both", func(t *testing.T) {
		perms := getMaintenancePermissionsBody(t, app, probeURL, bearer(jwtOwner))
		assert.True(t, perms.Read)
		assert.True(t, perms.Write)
	})

	t.Run("JWT with read only sees read only", func(t *testing.T) {
		perms := getMaintenancePermissionsBody(t, app, probeURL, bearer(jwtReadOnly))
		assert.True(t, perms.Read)
		assert.False(t, perms.Write)
	})

	t.Run("JWT without roles sees neither", func(t *testing.T) {
		perms := getMaintenancePermissionsBody(t, app, probeURL, bearer(jwtNoRole))
		assert.False(t, perms.Read)
		assert.False(t, perms.Write)
	})

	t.Run("API key with a read scope sees read but not the owner's write", func(t *testing.T) {
		perms := getMaintenancePermissionsBody(t, app, probeURL, bearer(keyReadOnly))
		assert.True(t, perms.Read)
		assert.False(t, perms.Write,
			"the owner holds docker.maintenance.write but the key's scope is read only")
	})

	t.Run("API key without scopes is admitted but sees neither", func(t *testing.T) {
		perms := getMaintenancePermissionsBody(t, app, probeURL, bearer(keyNoScope))
		assert.False(t, perms.Read,
			"a scopeless key must not be shown the owner's capability")
		assert.False(t, perms.Write)
	})
}

func getMaintenancePermissionsBody(t *testing.T, app *e2e.TestApp, path, authHeader string) maintenance.MaintenancePermissions {
	t.Helper()
	resp := mustRequest(t, app, http.MethodGet, path, authHeader)
	require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[maintenance.PermissionsData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Maintenance
}
