package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func TestAuthzImageUpdatesGlobalList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	NewAuthzFixture(t, app)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/image-updates"}, "", 401)
	})
}

func TestAuthzImageUpdatesServerScopedList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	listURL := "/api/v1/servers/" + sid + "/image-updates"

	otherServer, _ := f.AddServer("other-srv")

	_, jwtOtherServer, _ := f.UserWithRole("other-server-reader", otherServer, permnames.StacksRead, "*")
	_, jwtNoPerm := f.User("no-perm")

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"}}},
		{Name: "rr", Grants: []RoleGrant{{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"}}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.StacksRead, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		{Permission: permnames.ServersRead, StackPattern: "*"},
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, "", 401)
	})
	t.Run("JWT with stacks.read on a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtOtherServer), 403)
	})
	t.Run("JWT with no server roles returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtNoPerm), 403)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key scoped to a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with a different permission scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key is denied after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(key), 403)
	})
}
