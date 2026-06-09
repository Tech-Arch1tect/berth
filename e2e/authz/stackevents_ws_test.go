package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func TestAuthzStackEventsWebSocket(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/ws/api/servers/" + sid + "/stacks/prod-web/events"
	stagingURL := "/ws/api/servers/" + sid + "/stacks/staging-web/events"

	const admittedReachedHandler = http.StatusUpgradeRequired

	_, jwtRead, _ := f.UserWithRole("events-read", f.Server, permnames.StacksRead, "prod-*")

	_, jwtManageNoRead := f.UserWithRoles("events-manage-no-read", []RoleSpec{
		{Name: "events-mnr", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksManage, StackPattern: "prod-*"}}},
	})
	_, jwtAdmin := f.Admin("events-admin")

	noScopeOwner, _, _ := f.UserWithRole("events-noscope-owner", f.Server, permnames.StacksRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "events-noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("events-matching-owner", f.Server, permnames.StacksRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "events-matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("events-wrongperm-owner", f.Server, permnames.StacksManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "events-wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "*"),
	})

	t.Run("unauthenticated is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT with stacks.read on the stack is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtRead), admittedReachedHandler)
	})
	t.Run("JWT with stacks.read on a non-matching stack is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtRead), 403)
	})
	t.Run("JWT with stacks.manage but without stacks.read is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtManageNoRead), 403)
	})
	t.Run("JWT admin is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtAdmin), admittedReachedHandler)
	})
	t.Run("API key without the read scope is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key whose scope is a different permission is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key with the read scope is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyMatching), admittedReachedHandler)
	})
}
