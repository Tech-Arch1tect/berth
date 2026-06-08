package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func TestAuthzUserServersList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	const listURL = "/api/v1/servers"

	keyOwner, _, _ := f.UserWithRole("key-owner", f.Server, permnames.StacksRead, "*")
	keyWithoutServersRead := f.APIKeyFor(keyOwner, "without-servers-read", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, "", 401)
	})
	t.Run("API key without servers.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyWithoutServersRead), 403)
	})
}

func TestAuthzUserServerGet(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	getURL := "/api/v1/servers/" + sid

	otherServer, _ := f.AddServer("other-srv")
	otherGetURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID)

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "*")
	_, jwtOtherServer, _ := f.UserWithRole("other-server-reader", otherServer, permnames.StacksRead, "*")
	_, jwtNoPerm := f.User("no-perm")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"}}},
		{Name: "rb", Grants: []RoleGrant{{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"}}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.StacksRead, "*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		{Permission: permnames.ServersRead, StackPattern: "*"},
	})

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"}}},
		{Name: "rr", Grants: []RoleGrant{{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"}}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
		{Permission: permnames.ServersRead, StackPattern: "*"},
	})

	missingServersReadOwner, _, _ := f.UserWithRole("missing-servers-read-owner", f.Server, permnames.StacksRead, "*")
	keyMissingServersRead := f.APIKeyFor(missingServersReadOwner, "missing-servers-read-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, "", 401)
	})
	t.Run("JWT with stacks.read on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT with stacks.read on a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(jwtOtherServer), 403)
	})
	t.Run("JWT with no server roles returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(jwtNoPerm), 403)
	})
	t.Run("JWT with multi-role union admits each server in the union", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherGetURL}, bearer(jwtUnion), 200)
	})
	t.Run("JWT admin is admitted on any server", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherGetURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with stacks.read + servers.read scopes is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(keyMatching), 200)
	})
	t.Run("API key scoped to a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with stacks.read but missing servers.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(keyMissingServersRead), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
			{Permission: permnames.ServersRead, StackPattern: "*"},
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: getURL}, bearer(key), 403)
	})
}

func TestAuthzUserServerStatistics(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	f.Agent.RegisterJSONHandler("/api/stacks/summary", map[string]any{})

	sid := e2e.Itoa(f.Server.ID)
	statsURL := "/api/v1/servers/" + sid + "/statistics"

	otherServer, _ := f.AddServer("other-srv")
	otherStatsURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID) + "/statistics"

	_, jwt, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "*")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: statsURL}, "", 401)
	})
	t.Run("JWT with stacks.read on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: statsURL}, bearer(jwt), 200)
	})
	t.Run("JWT with stacks.read on a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherStatsURL}, bearer(jwt), 403)
	})
}
