package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/stack"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func registerStackMetadataEndpoints(agent *e2e.MockAgent, stackName string) {
	base := "/api/stacks/" + stackName
	agent.RegisterJSONHandler(base, map[string]any{
		"name": stackName, "status": "running",
	})
	agent.RegisterJSONHandler(base+"/networks", []map[string]any{})
	agent.RegisterJSONHandler(base+"/volumes", []map[string]any{})
	agent.RegisterJSONHandler(base+"/environment", map[string]any{})
	agent.RegisterJSONHandler(base+"/images", []map[string]any{})
	agent.RegisterJSONHandler(base+"/stats", map[string]any{
		"stack_name": stackName, "containers": []any{},
	})
	agent.RegisterHandler(base+"/compose", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPatch {
			_, _ = w.Write([]byte(`{"success":true,"content":"version: '3'\nservices: {}\n"}`))
			return
		}
		_, _ = w.Write([]byte(`{"content":"version: '3'\nservices: {}\n"}`))
	})
}

func keyScope(serverID *uint, perm, pattern string) ScopeSpec {
	return ScopeSpec{Permission: perm, ServerID: serverID, StackPattern: pattern}
}

func TestAuthzStackRead(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerStackMetadataEndpoints(f.Agent, "prod-web")
	registerStackMetadataEndpoints(f.Agent, "staging-web")
	registerStackMetadataEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web"

	_, jwtProdRole, _ := f.UserWithRole("prod", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"}}},
		{Name: "rb", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"}}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.StacksRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.StacksRead, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"}}},
		{Name: "rr", Grants: []RoleGrant{{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"}}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})

	t.Run("JWT with stacks.read on in-pattern stack is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtProdRole), 200)
	})

	t.Run("JWT with stacks.read out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtProdRole), 403)
	})

	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db"
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

	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyAdminNoScope), 403)
	})

	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 403)
	})
}

func TestAuthzStackMetadataSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerStackMetadataEndpoints(f.Agent, "prod-web")
	registerStackMetadataEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.StacksRead, "prod-*")

	siblings := []string{"networks", "volumes", "environment", "images", "stats"}
	for _, sib := range siblings {
		t.Run(sib, func(t *testing.T) {
			prod := "/api/v1/servers/" + sid + "/stacks/prod-web/" + sib
			staging := "/api/v1/servers/" + sid + "/stacks/staging-web/" + sib

			t.Run("unauthenticated returns 401", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prod}, "", 401)
			})
			t.Run("JWT in-pattern is admitted", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prod}, bearer(jwt), 200)
			})
			t.Run("JWT out-of-pattern returns 403", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: staging}, bearer(jwt), 403)
			})
		})
	}
}

func TestAuthzStackComposeRead(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerStackMetadataEndpoints(f.Agent, "prod-web")
	registerStackMetadataEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/compose"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/compose"

	_, jwtFiles, _ := f.UserWithRole("files", f.Server, permnames.FilesRead, "prod-*")

	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "prod-*")

	_, jwtAdmin := f.Admin("compose-admin")
	_, jwtUnion := f.UserWithRoles("union-files", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesRead, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesRead, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.FilesRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.FilesRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.FilesRead, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.FilesRead, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT files.read on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtFiles), 200)
	})
	t.Run("JWT files.read on out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtFiles), 403)
	})
	t.Run("JWT stacks.read only returns 403 (no files.read)", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtStacksOnly), 403)
	})
	t.Run("JWT multi-role union admits each unioned pattern", func(t *testing.T) {
		registerStackMetadataEndpoints(f.Agent, "ops-db")
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/compose"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: opsURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtUnion), 403)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with matching scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNarrower), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(keyNarrower), 403)
	})
	t.Run("API key with wrong permission scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongPerm), 403)
	})
}

func TestAuthzStackComposeWrite(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerStackMetadataEndpoints(f.Agent, "prod-web")
	registerStackMetadataEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/compose"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/compose"

	body := map[string]any{
		"changes": map[string]any{
			"add_services": map[string]any{
				"web": map[string]any{"image": "nginx:latest"},
			},
		},
	}

	assertNoComposeWrite := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPatch, "/compose")
	}

	_, jwtWrite, _ := f.UserWithRole("write", f.Server, permnames.FilesWrite, "prod-*")
	_, jwtRead, _ := f.UserWithRole("read-only", f.Server, permnames.FilesRead, "prod-*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only-w", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("write-admin")

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.FilesWrite, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.FilesWrite, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesWrite, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.FilesWrite, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, "", 401)
		assertNoComposeWrite(t)
	})
	t.Run("JWT files.write on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(jwtWrite), 200)
	})
	t.Run("JWT files.write on out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: stagingURL, Body: body}, bearer(jwtWrite), 403)
		assertNoComposeWrite(t)
	})
	t.Run("JWT files.read only returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(jwtRead), 403)
		assertNoComposeWrite(t)
	})
	t.Run("JWT stacks.read only returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(jwtStacksOnly), 403)
		assertNoComposeWrite(t)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(keyNoScope), 403)
		assertNoComposeWrite(t)
	})
	t.Run("API key with files.write+stacks.read scopes is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key with wrong permission returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPatch, Path: prodURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoComposeWrite(t)
	})
}

func TestAuthzStackCreate(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	f.Agent.RegisterHandler("/api/stacks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"success":true,"stack":{"name":"prod-new","status":"running"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	})

	sid := e2e.Itoa(f.Server.ID)
	createURL := "/api/v1/servers/" + sid + "/stacks"

	_, jwt, _ := f.UserWithRole("create", f.Server, permnames.StacksCreate, "prod-*")
	_, jwtRead, _ := f.UserWithRole("read-only-create", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("create-admin")

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: map[string]any{"name": "prod-new"}}, "", 401)
		f.Agent.AssertNotCalled(t, http.MethodPost, "/stacks")
	})

	t.Run("JWT with matching create pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: map[string]any{"name": "prod-new"}}, bearer(jwt), 201)
	})

	t.Run("JWT whose create pattern doesn't match requested name returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: map[string]any{"name": "staging-new"}}, bearer(jwt), 403)
		f.Agent.AssertNotCalled(t, http.MethodPost, "/stacks")
	})

	t.Run("JWT with stacks.read but not stacks.create returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: map[string]any{"name": "prod-new"}}, bearer(jwtRead), 403)
		f.Agent.AssertNotCalled(t, http.MethodPost, "/stacks")
	})

	t.Run("JWT admin is admitted on any name", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: map[string]any{"name": "anything-new"}}, bearer(jwtAdmin), 201)
	})
}

func TestAuthzStackCapabilityProbes(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	_, jwt := f.User("probe")

	t.Run("can-create admits any authenticated user", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/servers/" + sid + "/stacks/can-create"}, bearer(jwt), 200)
	})
	t.Run("can-create returns 401 when unauthenticated", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/servers/" + sid + "/stacks/can-create"}, "", 401)
	})
	t.Run("permissions probe admits any authenticated user", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/servers/" + sid + "/stacks/some-stack/permissions"}, bearer(jwt), 200)
	})
	t.Run("permissions probe returns 401 when unauthenticated", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/servers/" + sid + "/stacks/some-stack/permissions"}, "", 401)
	})
}

func TestAuthzStackPermissionsProbeBody(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	probeURL := "/api/v1/servers/" + sid + "/stacks/prod-web/permissions"

	owner, jwtOwner, _ := f.UserWithRole("manage-owner", f.Server, permnames.StacksManage, "prod-*")
	keyReadOnly := f.APIKeyFor(owner, "read-only-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})
	keyNoScope := f.APIKeyFor(owner, "noscope-key", nil)
	keyOtherStacks := f.APIKeyFor(owner, "other-stacks-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "ops-*"),
	})

	_, jwtNoRole := f.User("roleless")

	t.Run("JWT owner sees its own granted permissions", func(t *testing.T) {
		perms := getStackPermissionsBody(t, app, probeURL, bearer(jwtOwner))
		assert.ElementsMatch(t, []string{permnames.StacksRead, permnames.StacksManage}, perms)
	})

	t.Run("JWT without roles sees an empty permission set", func(t *testing.T) {
		assert.Empty(t, getStackPermissionsBody(t, app, probeURL, bearer(jwtNoRole)))
	})

	t.Run("API key sees only its scoped permissions, not the owner's", func(t *testing.T) {
		perms := getStackPermissionsBody(t, app, probeURL, bearer(keyReadOnly))
		assert.ElementsMatch(t, []string{permnames.StacksRead}, perms,
			"the owner holds stacks.manage but the key's scope is stacks.read only")
	})

	t.Run("API key without scopes is admitted but sees no permissions", func(t *testing.T) {
		assert.Empty(t, getStackPermissionsBody(t, app, probeURL, bearer(keyNoScope)),
			"a scopeless key must not be shown the owner's permissions")
	})

	t.Run("API key scoped to other stacks sees no permissions on this stack", func(t *testing.T) {
		assert.Empty(t, getStackPermissionsBody(t, app, probeURL, bearer(keyOtherStacks)))
	})
}

func TestAuthzCanCreateStackProbeBody(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	probeURL := "/api/v1/servers/" + sid + "/stacks/can-create"

	owner, jwtOwner, _ := f.UserWithRole("create-owner", f.Server, permnames.StacksCreate, "*")
	keyCreate := f.APIKeyFor(owner, "create-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksCreate, "*"),
	})
	keyNoScope := f.APIKeyFor(owner, "noscope-key", nil)
	keyReadOnly := f.APIKeyFor(owner, "read-only-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	_, jwtNoRole := f.User("roleless")

	t.Run("JWT with stacks.create can create", func(t *testing.T) {
		assert.True(t, getCanCreateBody(t, app, probeURL, bearer(jwtOwner)))
	})

	t.Run("JWT without stacks.create cannot create", func(t *testing.T) {
		assert.False(t, getCanCreateBody(t, app, probeURL, bearer(jwtNoRole)))
	})

	t.Run("API key with a stacks.create scope can create", func(t *testing.T) {
		assert.True(t, getCanCreateBody(t, app, probeURL, bearer(keyCreate)))
	})

	t.Run("API key without scopes is admitted but cannot create", func(t *testing.T) {
		assert.False(t, getCanCreateBody(t, app, probeURL, bearer(keyNoScope)),
			"a scopeless key must not inherit the owner's create capability")
	})

	t.Run("API key with only a stacks.read scope cannot create", func(t *testing.T) {
		assert.False(t, getCanCreateBody(t, app, probeURL, bearer(keyReadOnly)),
			"the owner can create but the key's scopes do not cover stacks.create")
	})
}

func getStackPermissionsBody(t *testing.T, app *e2e.TestApp, path, authHeader string) []string {
	t.Helper()
	resp := mustRequest(t, app, http.MethodGet, path, authHeader)
	require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[stack.StackPermissionsData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Permissions
}

func getCanCreateBody(t *testing.T, app *e2e.TestApp, path, authHeader string) bool {
	t.Helper()
	resp := mustRequest(t, app, http.MethodGet, path, authHeader)
	require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[stack.CanCreateStackData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.CanCreate
}
