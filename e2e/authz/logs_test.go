package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func registerLogsEndpoints(agent *e2e.MockAgent, stackName string) {
	base := "/api/stacks/" + stackName
	empty := map[string]any{"logs": []any{}}
	agent.RegisterJSONHandler(base+"/logs", empty)
	agent.RegisterJSONHandler(base+"/containers/web/logs", empty)
}

func TestAuthzLogsStackRead(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerLogsEndpoints(f.Agent, "prod-web")
	registerLogsEndpoints(f.Agent, "staging-web")
	registerLogsEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/logs"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/logs"

	_, jwtLogs, _ := f.UserWithRole("logs", f.Server, permnames.LogsRead, "prod-*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.LogsRead, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.LogsRead, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.LogsRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.LogsRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.LogsRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.LogsRead, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.LogsRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.LogsRead, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.LogsRead, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.LogsRead, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.LogsRead, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT with logs.read on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtLogs), 200)
	})
	t.Run("JWT with logs.read out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtLogs), 403)
	})
	t.Run("JWT stacks.read only returns 403 (no logs.read)", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtStacksOnly), 403)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/logs"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: opsURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtUnion), 403)
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with scope equal to role pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNarrower), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(keyNarrower), 403)
	})
	t.Run("API key scoped to wrong server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with wrong permission scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.LogsRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.LogsRead, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 403)
	})
}

func TestAuthzLogsContainerLogs(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerLogsEndpoints(f.Agent, "prod-web")
	registerLogsEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/containers/web/logs"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/containers/web/logs"

	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.LogsRead, "prod-*")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwt), 200)
	})
	t.Run("JWT out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwt), 403)
	})
}
