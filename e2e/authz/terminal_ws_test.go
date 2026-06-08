package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func TestAuthzTerminalWebSocket(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/ws/api/servers/" + sid + "/stacks/prod-web/terminal"
	stagingURL := "/ws/api/servers/" + sid + "/stacks/staging-web/terminal"

	const admittedReachedHandler = http.StatusBadGateway

	_, jwtManage, _ := f.UserWithRole("manage", f.Server, permnames.StacksManage, "prod-*")
	_, jwtReadOnly, _ := f.UserWithRole("read-only", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("term-admin")

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksManage, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.StacksManage, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.StacksManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	t.Run("unauthenticated is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT with stacks.manage on the stack is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtManage), admittedReachedHandler)
	})
	t.Run("JWT with stacks.manage on a non-matching stack is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtManage), 403)
	})
	t.Run("JWT with only stacks.read is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtReadOnly), 403)
	})
	t.Run("JWT admin is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtAdmin), admittedReachedHandler)
	})
	t.Run("API key without the manage scope is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key whose scope is a different permission is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key with the manage scope is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyMatching), admittedReachedHandler)
	})
}
