package authz

import (
	"net/http"
	"testing"
	"time"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/vulnscan"

	"github.com/stretchr/testify/require"
)

func registerVulnscanAgentEndpoints(agent *e2e.MockAgent, stackName string) {
	agent.RegisterJSONHandler("/api/stacks/"+stackName+"/scan", map[string]any{
		"id":           "agent-scan-" + stackName,
		"stack_name":   stackName,
		"status":       "running",
		"total_images": 0,
	})
}

func seedScan(t *testing.T, app *e2e.TestApp, serverID uint, stackName string) *vulnscan.ImageScan {
	t.Helper()
	scan := &vulnscan.ImageScan{
		ServerID:  serverID,
		StackName: stackName,
		Status:    vulnscan.ScanStatusCompleted,
		StartedAt: time.Now(),
	}
	require.NoError(t, app.DB.Create(scan).Error, "seed scan for %s/%d", stackName, serverID)
	return scan
}

func TestAuthzVulnscanGetLatest(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	seedScan(t, app, f.Server.ID, "prod-web")
	seedScan(t, app, f.Server.ID, "staging-web")
	seedScan(t, app, f.Server.ID, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/vulnscan"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/vulnscan"

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "prod-*")
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
	seedScan(t, app, otherServer.ID, "prod-web")
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
	t.Run("JWT with stacks.read on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT with stacks.read out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtReader), 403)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/vulnscan"
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

func TestAuthzVulnscanStackSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.StacksRead, "prod-*")

	siblings := []string{"history", "trend"}
	for _, sib := range siblings {
		t.Run(sib, func(t *testing.T) {
			prod := "/api/v1/servers/" + sid + "/stacks/prod-web/vulnscan/" + sib
			staging := "/api/v1/servers/" + sid + "/stacks/staging-web/vulnscan/" + sib

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

func TestAuthzVulnscanStartScan(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerVulnscanAgentEndpoints(f.Agent, "prod-web")
	registerVulnscanAgentEndpoints(f.Agent, "staging-web")
	registerVulnscanAgentEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/vulnscan"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/vulnscan"

	assertNoScanStart := func(t *testing.T, stackName string) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/stacks/"+stackName+"/scan")
	}

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("write-admin")
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

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, "", 401)
		assertNoScanStart(t, "prod-web")
	})
	t.Run("JWT with stacks.read on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT with stacks.read out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL}, bearer(jwtReader), 403)
		assertNoScanStart(t, "staging-web")
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/vulnscan"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: opsURL}, bearer(jwtUnion), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL}, bearer(jwtUnion), 403)
		assertNoScanStart(t, "staging-web")
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(keyNoScope), 403)
		assertNoScanStart(t, "prod-web")
	})
	t.Run("API key with matching scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(keyNarrower), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL}, bearer(keyNarrower), 403)
		assertNoScanStart(t, "staging-web")
	})
	t.Run("API key scoped to wrong server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(keyWrongServer), 403)
		assertNoScanStart(t, "prod-web")
	})
	t.Run("API key (admin owner) without matching scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(keyAdminNoScope), 403)
		assertNoScanStart(t, "prod-web")
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL}, bearer(key), 403)
		assertNoScanStart(t, "prod-web")
	})
}

func TestAuthzVulnscanScanByID(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	prodScan := seedScan(t, app, f.Server.ID, "prod-web")
	scanURL := "/api/v1/vulnscan/" + e2e.Itoa(prodScan.ID)

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "prod-*")
	_, jwtOutOfPattern, _ := f.UserWithRole("out-of-pattern", f.Server, permnames.StacksRead, "staging-*")
	_, jwtNoPerm := f.User("no-perm")
	_, jwtAdmin := f.Admin("by-id-admin")

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.StacksRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.StacksRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, "", 401)
	})
	t.Run("JWT with stacks.read on scan's stack is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT whose pattern doesn't match scan's stack returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(jwtOutOfPattern), 403)
	})
	t.Run("JWT without any matching role returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(jwtNoPerm), 403)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with matching scope on scan's stack is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(keyMatching), 200)
	})
	t.Run("API key with no scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: scanURL}, bearer(keyNoScope), 403)
	})
	t.Run("non-existent scan id returns 404", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: "/api/v1/vulnscan/999999999"}, bearer(jwtReader), 404)
	})
}

func TestAuthzVulnscanScanByIDSummary(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	prodScan := seedScan(t, app, f.Server.ID, "prod-web")
	stagingScan := seedScan(t, app, f.Server.ID, "staging-web")

	prodURL := "/api/v1/vulnscan/" + e2e.Itoa(prodScan.ID) + "/summary"
	stagingURL := "/api/v1/vulnscan/" + e2e.Itoa(stagingScan.ID) + "/summary"

	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.StacksRead, "prod-*")

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

func TestAuthzVulnscanCompare(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	baseScan := seedScan(t, app, f.Server.ID, "prod-web")
	compareScanSameStack := seedScan(t, app, f.Server.ID, "prod-web")
	compareScanOtherStack := seedScan(t, app, f.Server.ID, "staging-web")

	otherServer, _ := f.AddServer("other-srv")
	compareScanOtherServer := seedScan(t, app, otherServer.ID, "prod-web")

	sameStackURL := "/api/v1/vulnscan/compare/" + e2e.Itoa(baseScan.ID) + "/" + e2e.Itoa(compareScanSameStack.ID)
	crossStackURL := "/api/v1/vulnscan/compare/" + e2e.Itoa(baseScan.ID) + "/" + e2e.Itoa(compareScanOtherStack.ID)
	crossServerURL := "/api/v1/vulnscan/compare/" + e2e.Itoa(baseScan.ID) + "/" + e2e.Itoa(compareScanOtherServer.ID)

	_, jwtReader, _ := f.UserWithRole("reader", f.Server, permnames.StacksRead, "prod-*")
	_, jwtNoPerm := f.User("no-perm")
	_, jwtAdmin := f.Admin("cmp-admin")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: sameStackURL}, "", 401)
	})
	t.Run("JWT authorised for both scans' stacks is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: sameStackURL}, bearer(jwtReader), 200)
	})
	t.Run("JWT authorised for base but not compare scan's stack returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: crossStackURL}, bearer(jwtReader), 403)
	})
	t.Run("JWT authorised on this server but compare scan is on another server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: crossServerURL}, bearer(jwtReader), 403)
	})
	t.Run("JWT without any matching role returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: sameStackURL}, bearer(jwtNoPerm), 403)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: sameStackURL}, bearer(jwtAdmin), 200)
	})
	t.Run("non-existent base scan id returns 404", func(t *testing.T) {
		missingURL := "/api/v1/vulnscan/compare/999999999/" + e2e.Itoa(compareScanSameStack.ID)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: missingURL}, bearer(jwtReader), 404)
	})
}
