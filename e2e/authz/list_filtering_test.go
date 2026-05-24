package authz

import (
	"testing"
	"time"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"
	"berth/internal/domain/stack"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServersListFiltering(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	path := "/api/v1/servers"

	t.Run("JWT with role on prod-* pattern sees the server", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("prodrole", f.Server, permnames.StacksRead, "prod-*")
		servers := getServersList(t, app, path, "Bearer "+jwt, 200)
		assertContainsServerID(t, servers, f.Server.ID)
		assert.Len(t, servers, 1, "single-server fixture should return exactly one entry")
	})

	t.Run("JWT with no role sees an empty list", func(t *testing.T) {
		_, jwt := f.User("norole")
		servers := getServersList(t, app, path, "Bearer "+jwt, 200)
		assert.Empty(t, servers)
	})

	t.Run("JWT admin sees the server", func(t *testing.T) {
		_, jwt := f.Admin("listadmin")
		servers := getServersList(t, app, path, "Bearer "+jwt, 200)
		assertContainsServerID(t, servers, f.Server.ID)
	})

	t.Run("API key with no stacks.read scope sees an empty list", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("k1owner", f.Server, permnames.StacksRead, "prod-*")
		key := f.APIKeyFor(owner, "k1", []ScopeSpec{
			{Permission: permnames.ServersRead, ServerID: &f.Server.ID, StackPattern: "*"},
		})
		servers := getServersList(t, app, path, "Bearer "+key, 200)
		assert.Empty(t, servers,
			"key with only servers.read (endpoint gate) must not list any server's stacks visibility")
	})

	t.Run("API key with stacks.read scope on the server sees it", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("k2owner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "k2", []ScopeSpec{
			{Permission: permnames.ServersRead, ServerID: &f.Server.ID, StackPattern: "*"},
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "*"},
		})
		servers := getServersList(t, app, path, "Bearer "+key, 200)
		assertContainsServerID(t, servers, f.Server.ID)
	})

	t.Run("two-server fixture: JWT with role on the first server sees only the first", func(t *testing.T) {
		serverB, _ := f.AddServer("two-b")
		_, jwt, _ := f.UserWithRole("twoab", f.Server, permnames.StacksRead, "*")
		servers := getServersList(t, app, path, "Bearer "+jwt, 200)
		assertContainsServerID(t, servers, f.Server.ID)
		assertDoesNotContainServerID(t, servers, serverB.ID)
	})

	t.Run("two-server fixture: API key with stacks.read on first server only sees only the first", func(t *testing.T) {
		serverB, _ := f.AddServer("two-c")
		owner, _ := f.UserWithRoles("dualowner", []RoleSpec{
			{Name: "ra", Grants: []RoleGrant{
				{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
			}},
			{Name: "rb", Grants: []RoleGrant{
				{Server: serverB, Permission: permnames.StacksRead, StackPattern: "*"},
			}},
		})

		key := f.APIKeyFor(owner, "twokey", []ScopeSpec{
			{Permission: permnames.ServersRead, ServerID: &f.Server.ID, StackPattern: "*"},
			{Permission: permnames.ServersRead, ServerID: &serverB.ID, StackPattern: "*"},
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "*"},
		})
		servers := getServersList(t, app, path, "Bearer "+key, 200)
		assertContainsServerID(t, servers, f.Server.ID)
		assertDoesNotContainServerID(t, servers, serverB.ID)
	})

	t.Run("API key without servers.read scope is rejected by middleware", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("noendpoint", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "noep", []ScopeSpec{
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "*"},
		})
		resp := mustRequest(t, app, "GET", path, "Bearer "+key)
		assert.Equal(t, 403, resp.StatusCode, "body: %s", resp.GetString())
	})
}

func TestImageUpdatesGlobalListFiltering(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	seedCanonicalImageUpdates(t, app, f.Server.ID)

	path := "/api/v1/image-updates"

	t.Run("JWT with role on prod-* sees only the prod-* rows", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("prodrole", f.Server, permnames.StacksRead, "prod-*")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db"})
	})

	t.Run("JWT with wildcard role sees all rows", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("wildrole", f.Server, permnames.StacksRead, "*")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db", "staging-web", "ops-db"})
	})

	t.Run("JWT with no role sees an empty list", func(t *testing.T) {
		_, jwt := f.User("norole")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.Empty(t, updates)
	})

	t.Run("JWT admin sees all rows", func(t *testing.T) {
		_, jwt := f.Admin("iuadmin")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db", "staging-web", "ops-db"})
	})

	t.Run("API key with stacks.read on prod-* sees only the prod-* rows", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("prodkeyowner", f.Server, permnames.StacksRead, "prod-*")
		key := f.APIKeyFor(owner, "prodkey", []ScopeSpec{
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "prod-*"},
		})
		updates := getImageUpdates(t, app, path, "Bearer "+key, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db"})
	})

	t.Run("API key pattern narrows an owner's wildcard role", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("wildowner", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "stagingkey", []ScopeSpec{
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "staging-*"},
		})
		updates := getImageUpdates(t, app, path, "Bearer "+key, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"staging-web"})
	})
}

func TestServerImageUpdatesListFiltering(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	seedCanonicalImageUpdates(t, app, f.Server.ID)

	path := "/api/v1/servers/" + e2e.Itoa(f.Server.ID) + "/image-updates"

	t.Run("JWT with role on prod-* sees only the prod-* rows", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("prodrole", f.Server, permnames.StacksRead, "prod-*")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db"})
	})

	t.Run("JWT with wildcard role sees all rows", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("wildrole", f.Server, permnames.StacksRead, "*")
		updates := getImageUpdates(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db", "staging-web", "ops-db"})
	})

	t.Run("JWT with no role returns 403", func(t *testing.T) {
		_, jwt := f.User("norole")
		resp := mustRequest(t, app, "GET", path, "Bearer "+jwt)
		assert.Equal(t, 403, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("JWT admin against nonexistent server returns 403", func(t *testing.T) {
		_, jwt := f.Admin("nonexistent-admin")
		resp := mustRequest(t, app, "GET", "/api/v1/servers/99999/image-updates", "Bearer "+jwt)
		assert.Equal(t, 403, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("API key without stacks.read on the server returns 403", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("nokeyscope", f.Server, permnames.StacksRead, "prod-*")
		key := f.APIKeyFor(owner, "nokeyscope", []ScopeSpec{
			{Permission: permnames.ServersRead, ServerID: &f.Server.ID, StackPattern: "*"},
		})
		resp := mustRequest(t, app, "GET", path, "Bearer "+key)
		assert.Equal(t, 403, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("API key with stacks.read on prod-* sees only the prod-* rows", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("prodkey", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "prodkey", []ScopeSpec{
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "prod-*"},
		})
		updates := getImageUpdates(t, app, path, "Bearer "+key, 200)
		assert.ElementsMatch(t, stackNamesOf(updates), []string{"prod-web", "prod-db"})
	})
}

func TestServerStacksListFiltering(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	path := "/api/v1/servers/" + e2e.Itoa(f.Server.ID) + "/stacks"

	t.Run("JWT with role on prod-* sees only the prod-* stacks", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("prodrole", f.Server, permnames.StacksRead, "prod-*")
		stacks := getStacksList(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNames(stacks), []string{"prod-web", "prod-db"})
	})

	t.Run("JWT with role on *-web sees only the *-web stacks", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("webrole", f.Server, permnames.StacksRead, "*-web")
		stacks := getStacksList(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNames(stacks), []string{"prod-web", "staging-web"})
	})

	t.Run("JWT with wildcard role sees all stacks", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("wildrole", f.Server, permnames.StacksRead, "*")
		stacks := getStacksList(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNames(stacks), []string{"prod-web", "prod-db", "staging-web", "ops-db"})
	})

	t.Run("JWT with no role returns 403", func(t *testing.T) {
		_, jwt := f.User("norole")
		resp := mustRequest(t, app, "GET", path, "Bearer "+jwt)
		assert.Equal(t, 403, resp.StatusCode, "body: %s", resp.GetString())
	})

	t.Run("JWT with role pattern matching no stacks returns an empty array", func(t *testing.T) {
		_, jwt, _ := f.UserWithRole("nomatch", f.Server, permnames.StacksRead, "nonexistent-*")
		resp := mustRequest(t, app, "GET", path, "Bearer "+jwt)
		require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
		body := resp.GetString()
		assert.Contains(t, body, `"stacks":[]`,
			"empty stacks list must serialise as [], not null")
	})

	t.Run("JWT admin sees all stacks", func(t *testing.T) {
		_, jwt := f.Admin("stadmin")
		stacks := getStacksList(t, app, path, "Bearer "+jwt, 200)
		assert.ElementsMatch(t, stackNames(stacks), []string{"prod-web", "prod-db", "staging-web", "ops-db"})
	})

	t.Run("API key with stacks.read on prod-* sees only the prod-* stacks", func(t *testing.T) {
		owner, _, _ := f.UserWithRole("prodkey", f.Server, permnames.StacksRead, "*")
		key := f.APIKeyFor(owner, "prodkey", []ScopeSpec{
			{Permission: permnames.StacksRead, ServerID: &f.Server.ID, StackPattern: "prod-*"},
		})
		stacks := getStacksList(t, app, path, "Bearer "+key, 200)
		assert.ElementsMatch(t, stackNames(stacks), []string{"prod-web", "prod-db"})
	})
}

func mustRequest(t *testing.T, app *e2e.TestApp, method, path, authHeader string) *e2etesting.Response {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  method,
		Path:    path,
		Headers: map[string]string{"Authorization": authHeader},
	})
	require.NoError(t, err)
	return resp
}

func getServersList(t *testing.T, app *e2e.TestApp, path, authHeader string, wantStatus int) []server.ServerInfo {
	t.Helper()
	resp := mustRequest(t, app, "GET", path, authHeader)
	require.Equal(t, wantStatus, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[server.ListServersData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Servers
}

func getImageUpdates(t *testing.T, app *e2e.TestApp, path, authHeader string, wantStatus int) []imageupdates.ImageUpdate {
	t.Helper()
	resp := mustRequest(t, app, "GET", path, authHeader)
	require.Equal(t, wantStatus, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[imageupdates.ImageUpdatesData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Updates
}

func getStacksList(t *testing.T, app *e2e.TestApp, path, authHeader string, wantStatus int) []stack.Stack {
	t.Helper()
	resp := mustRequest(t, app, "GET", path, authHeader)
	require.Equal(t, wantStatus, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[stack.ListStacksData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Stacks
}

func stackNamesOf(updates []imageupdates.ImageUpdate) []string {
	names := make([]string, 0, len(updates))
	for _, u := range updates {
		names = append(names, u.StackName)
	}
	return names
}

func stackNames(stacks []stack.Stack) []string {
	names := make([]string, 0, len(stacks))
	for _, s := range stacks {
		names = append(names, s.Name)
	}
	return names
}

func assertContainsServerID(t *testing.T, servers []server.ServerInfo, id uint) {
	t.Helper()
	for _, s := range servers {
		if s.ID == id {
			return
		}
	}
	t.Fatalf("expected list to contain server ID %d, got %+v", id, servers)
}

func assertDoesNotContainServerID(t *testing.T, servers []server.ServerInfo, id uint) {
	t.Helper()
	for _, s := range servers {
		if s.ID == id {
			t.Fatalf("expected list NOT to contain server ID %d, but it does: %+v", id, servers)
		}
	}
}

func seedCanonicalImageUpdates(t *testing.T, app *e2e.TestApp, serverID uint) {
	t.Helper()
	now := time.Now()
	for _, name := range DefaultStackNames() {
		row := imageupdates.ContainerImageUpdate{
			ServerID:         serverID,
			StackName:        name,
			ContainerName:    name + "-c1",
			CurrentImageName: name + ":latest",
			UpdateAvailable:  true,
			LastCheckedAt:    &now,
		}
		require.NoError(t, app.DB.Create(&row).Error,
			"seed image update for stack %q", name)
	}
}
