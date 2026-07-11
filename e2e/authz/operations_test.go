package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
)

func registerOperationsAgentEndpoints(agent *e2e.MockAgent, stackName string) {
	agent.RegisterJSONHandler("/api/stacks/"+stackName+"/operations", map[string]any{
		"operationId": "test-op-" + stackName,
	})
}

func TestAuthzOperationsStacksManageCommand(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerOperationsAgentEndpoints(f.Agent, "prod-web")
	registerOperationsAgentEndpoints(f.Agent, "staging-web")
	registerOperationsAgentEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/operations"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/operations"

	body := map[string]any{"command": "up"}

	assertNoOperation := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/operations")
	}

	_, jwtManage, _ := f.UserWithRole("manage", f.Server, permnames.StacksManage, "prod-*")
	_, jwtReadOnly, _ := f.UserWithRole("read-only", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("manage-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.StacksManage, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.StacksManage, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksManage, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.StacksManage, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.StacksManage, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.StacksManage, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.StacksManage, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.StacksManage, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.StacksManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, "", 401)
		assertNoOperation(t)
	})
	t.Run("JWT with stacks.manage on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtManage), 200)
	})
	t.Run("JWT with stacks.manage out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtManage), 403)
		assertNoOperation(t)
	})
	t.Run("JWT with stacks.read but not stacks.manage returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtReadOnly), 403)
		assertNoOperation(t)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/operations"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: opsURL, Body: body}, bearer(jwtUnion), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtUnion), 403)
		assertNoOperation(t)
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNoScope), 403)
		assertNoOperation(t)
	})
	t.Run("API key with stacks.manage+stacks.read scopes is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNarrower), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(keyNarrower), 403)
		assertNoOperation(t)
	})
	t.Run("API key scoped to wrong server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongServer), 403)
		assertNoOperation(t)
	})
	t.Run("API key with wrong permission scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoOperation(t)
	})
	t.Run("API key (admin owner) without matching scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyAdminNoScope), 403)
		assertNoOperation(t)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.StacksManage, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.StacksManage, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 403)
		assertNoOperation(t)
	})
}

func TestAuthzOperationsFilesWriteCommand(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerOperationsAgentEndpoints(f.Agent, "prod-web")
	registerOperationsAgentEndpoints(f.Agent, "staging-web")
	registerOperationsAgentEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/operations"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/operations"

	body := map[string]any{"command": "create-archive"}

	assertNoOperation := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/operations")
	}

	_, jwtFiles, _ := f.UserWithRole("files", f.Server, permnames.FilesWrite, "prod-*")
	_, jwtReadOnly, _ := f.UserWithRole("read-only", f.Server, permnames.FilesRead, "prod-*")
	_, jwtAdmin := f.Admin("files-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.FilesWrite, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.FilesWrite, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesWrite, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.FilesWrite, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesWrite, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.FilesWrite, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.FilesWrite, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.FilesWrite, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, "", 401)
		assertNoOperation(t)
	})
	t.Run("JWT with files.write on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtFiles), 200)
	})
	t.Run("JWT with files.write out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtFiles), 403)
		assertNoOperation(t)
	})
	t.Run("JWT with files.read but not files.write returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtReadOnly), 403)
		assertNoOperation(t)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/operations"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: opsURL, Body: body}, bearer(jwtUnion), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtUnion), 403)
		assertNoOperation(t)
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNoScope), 403)
		assertNoOperation(t)
	})
	t.Run("API key with files.write+stacks.read scopes is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNarrower), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(keyNarrower), 403)
		assertNoOperation(t)
	})
	t.Run("API key scoped to wrong server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongServer), 403)
		assertNoOperation(t)
	})
	t.Run("API key with wrong permission scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoOperation(t)
	})
	t.Run("API key (admin owner) without matching scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyAdminNoScope), 403)
		assertNoOperation(t)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.FilesWrite, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.FilesWrite, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 403)
		assertNoOperation(t)
	})
}

func TestAuthzOperationsBodyResolverDispatch(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerOperationsAgentEndpoints(f.Agent, "prod-web")

	sid := e2e.Itoa(f.Server.ID)
	url := "/api/v1/servers/" + sid + "/stacks/prod-web/operations"

	assertNoOperation := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/operations")
	}

	_, jwtManage, _ := f.UserWithRole("manage", f.Server, permnames.StacksManage, "prod-*")
	_, jwtFiles, _ := f.UserWithRole("files", f.Server, permnames.FilesWrite, "prod-*")

	t.Run("stacks.manage admits 'up' but denies 'create-archive' with no agent call", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "up"},
		}, bearer(jwtManage), 200)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-archive"},
		}, bearer(jwtManage), 403)
		assertNoOperation(t)
	})

	t.Run("files.write admits 'create-archive' but denies 'up' with no agent call", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-archive"},
		}, bearer(jwtFiles), 200)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "up"},
		}, bearer(jwtFiles), 403)
		assertNoOperation(t)
	})

	t.Run("'extract-archive' also dispatches to files.write", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "extract-archive"},
		}, bearer(jwtFiles), 200)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "extract-archive"},
		}, bearer(jwtManage), 403)
		assertNoOperation(t)
	})

	_, jwtBackupsManage, _ := f.UserWithRole("backups-manage", f.Server, permnames.BackupsManage, "prod-*")
	_, jwtBackupsRestore, _ := f.UserWithRole("backups-restore", f.Server, permnames.BackupsRestore, "prod-*")

	t.Run("'create-backup' dispatches to backups.manage, not stacks.manage", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-backup"},
		}, bearer(jwtBackupsManage), 200)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-backup"},
		}, bearer(jwtManage), 403)
		assertNoOperation(t)
	})

	t.Run("'restore-backup' dispatches to backups.restore; backups.manage is denied", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "restore-backup"},
		}, bearer(jwtBackupsRestore), 200)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "restore-backup"},
		}, bearer(jwtBackupsManage), 403)
		assertNoOperation(t)

		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "restore-backup"},
		}, bearer(jwtManage), 403)
		assertNoOperation(t)
	})

	t.Run("backup permissions admit no other command", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "up"},
		}, bearer(jwtBackupsManage), 403)
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-archive"},
		}, bearer(jwtBackupsManage), 403)
		assertStatus(t, app, &e2etesting.RequestOptions{
			Method: http.MethodPost, Path: url,
			Body: map[string]any{"command": "create-backup"},
		}, bearer(jwtBackupsRestore), 403)
		assertNoOperation(t)
	})
}

func TestAuthzOperationsBackupCommandScoping(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerOperationsAgentEndpoints(f.Agent, "prod-web")
	registerOperationsAgentEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/operations"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/operations"

	body := map[string]any{"command": "create-backup"}

	assertNoOperation := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/operations")
	}

	_, jwtBackups, _ := f.UserWithRole("backups", f.Server, permnames.BackupsManage, "prod-*")
	_, jwtAdmin := f.Admin("backups-admin")

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.BackupsManage, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.BackupsManage, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.BackupsManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, "", 401)
		assertNoOperation(t)
	})
	t.Run("JWT with backups.manage on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtBackups), 200)
	})
	t.Run("JWT with backups.manage out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtBackups), 403)
		assertNoOperation(t)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with backups.manage scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key without backups.manage scope returns 403 with no agent call even though owner holds the role", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoOperation(t)
	})
}
