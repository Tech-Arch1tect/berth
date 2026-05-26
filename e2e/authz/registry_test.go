package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"

	"github.com/stretchr/testify/require"
)

func seedRegistryCredential(t *testing.T, app *e2e.TestApp, serverID uint, registryURL string) *server.ServerRegistryCredential {
	t.Helper()
	cred := &server.ServerRegistryCredential{
		ServerID:     serverID,
		StackPattern: "*",
		RegistryURL:  registryURL,
		Username:     "seed-user",
		Password:     "seed-pass",
	}
	require.NoError(t, app.DB.Create(cred).Error, "seed registry credential")
	return cred
}

func countRegistryCredentials(t *testing.T, app *e2e.TestApp) int {
	t.Helper()
	var count int64
	require.NoError(t, app.DB.Model(&server.ServerRegistryCredential{}).Count(&count).Error)
	return int(count)
}

func TestAuthzRegistryList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	listURL := "/api/v1/servers/" + sid + "/registries"

	otherServer, _ := f.AddServer("other-srv")
	otherListURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID) + "/registries"

	_, jwtManager, _ := f.UserWithRole("manager", f.Server, permnames.RegistriesManage, "*")
	_, jwtOtherServer, _ := f.UserWithRole("other-server-manager", otherServer, permnames.RegistriesManage, "*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "*")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.RegistriesManage, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.RegistriesManage, "*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.RegistriesManage, "*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.RegistriesManage, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.RegistriesManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, "", 401)
	})
	t.Run("JWT with registries.manage on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtManager), 200)
	})
	t.Run("JWT with registries.manage on a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtOtherServer), 403)
	})
	t.Run("JWT with only stacks.read returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtStacksOnly), 403)
	})
	t.Run("JWT with multi-role union admits each server in the union", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherListURL}, bearer(jwtUnion), 200)
	})
	t.Run("JWT admin is admitted on any server", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: otherListURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with matching scope on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyMatching), 200)
	})
	t.Run("API key scoped to a different server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with only stacks.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.RegistriesManage, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.RegistriesManage, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: listURL}, bearer(key), 403)
	})
}

func TestAuthzRegistryGetByID(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	cred := seedRegistryCredential(t, app, f.Server.ID, "registry.example.com")

	sid := e2e.Itoa(f.Server.ID)
	credURL := "/api/v1/servers/" + sid + "/registries/" + e2e.Itoa(cred.ID)

	_, jwt, _ := f.UserWithRole("manager", f.Server, permnames.RegistriesManage, "*")
	_, jwtNoPerm := f.User("no-perm")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: credURL}, "", 401)
	})
	t.Run("JWT with registries.manage is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: credURL}, bearer(jwt), 200)
	})
	t.Run("JWT without registries.manage returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: credURL}, bearer(jwtNoPerm), 403)
	})
}

func TestAuthzRegistryCreate(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)
	createURL := "/api/v1/servers/" + sid + "/registries"

	otherServer, _ := f.AddServer("other-srv")
	otherCreateURL := "/api/v1/servers/" + e2e.Itoa(otherServer.ID) + "/registries"

	newBody := func(suffix string) map[string]any {
		return map[string]any{
			"stack_pattern": "*",
			"registry_url":  "registry-" + suffix + ".example.com",
			"username":      "u",
			"password":      "p",
		}
	}

	assertNoNewCredential := func(t *testing.T, before int) {
		t.Helper()
		after := countRegistryCredentials(t, app)
		require.Equal(t, before, after, "registry credential row count changed; %d → %d", before, after)
	}

	_, jwtManager, _ := f.UserWithRole("manager", f.Server, permnames.RegistriesManage, "*")
	_, jwtOtherServer, _ := f.UserWithRole("other-server-manager", otherServer, permnames.RegistriesManage, "*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "*")
	_, jwtAdmin := f.Admin("create-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.RegistriesManage, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.RegistriesManage, "*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.RegistriesManage, "*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.RegistriesManage, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.RegistriesManage, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.RegistriesManage, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("unauth")}, "", 401)
		assertNoNewCredential(t, before)
	})
	t.Run("JWT with registries.manage on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("admit-jwt")}, bearer(jwtManager), 201)
	})
	t.Run("JWT with registries.manage on a different server returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("wrong-server-jwt")}, bearer(jwtOtherServer), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("JWT with only stacks.read returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("stacks-only")}, bearer(jwtStacksOnly), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("JWT with multi-role union admits each server in the union", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("union-this")}, bearer(jwtUnion), 201)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: otherCreateURL, Body: newBody("union-other")}, bearer(jwtUnion), 201)
	})
	t.Run("JWT admin is admitted on any server", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("admin-this")}, bearer(jwtAdmin), 201)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: otherCreateURL, Body: newBody("admin-other")}, bearer(jwtAdmin), 201)
	})
	t.Run("API key with no scope returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("noscope-key")}, bearer(keyNoScope), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("API key with matching scope on this server is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("matching-key")}, bearer(keyMatching), 201)
	})
	t.Run("API key scoped to a different server returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("wrong-server-key")}, bearer(keyWrongServer), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("API key with only stacks.read scope returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("wrong-perm-key")}, bearer(keyWrongPerm), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("API key (admin owner) without matching scope returns 403 and creates no credential", func(t *testing.T) {
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("admin-noscope-key")}, bearer(keyAdminNoScope), 403)
		assertNoNewCredential(t, before)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.RegistriesManage, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.RegistriesManage, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("revoked-key-admit")}, bearer(key), 201)
		f.RevokeRole(owner, roleName)
		before := countRegistryCredentials(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: createURL, Body: newBody("revoked-key-deny")}, bearer(key), 403)
		assertNoNewCredential(t, before)
	})
}

func TestAuthzRegistryUpdate(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	cred := seedRegistryCredential(t, app, f.Server.ID, "registry-update.example.com")
	sid := e2e.Itoa(f.Server.ID)
	credURL := "/api/v1/servers/" + sid + "/registries/" + e2e.Itoa(cred.ID)

	body := map[string]any{
		"stack_pattern": "prod-*",
		"registry_url":  "registry-update.example.com",
		"username":      "new-user",
		"password":      "new-pass",
	}

	_, jwt, _ := f.UserWithRole("manager", f.Server, permnames.RegistriesManage, "*")
	_, jwtNoPerm := f.User("no-perm")

	credFields := func() (string, string) {
		t.Helper()
		var got server.ServerRegistryCredential
		require.NoError(t, app.DB.First(&got, cred.ID).Error)
		return got.Username, got.StackPattern
	}

	t.Run("unauthenticated returns 401 and the credential is unchanged", func(t *testing.T) {
		userBefore, patternBefore := credFields()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: credURL, Body: body}, "", 401)
		userAfter, patternAfter := credFields()
		require.Equal(t, userBefore, userAfter)
		require.Equal(t, patternBefore, patternAfter)
	})
	t.Run("JWT with registries.manage is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: credURL, Body: body}, bearer(jwt), 200)
	})
	t.Run("JWT without registries.manage returns 403 and the credential is unchanged", func(t *testing.T) {
		userBefore, patternBefore := credFields()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: credURL, Body: body}, bearer(jwtNoPerm), 403)
		userAfter, patternAfter := credFields()
		require.Equal(t, userBefore, userAfter)
		require.Equal(t, patternBefore, patternAfter)
	})
}

func TestAuthzRegistryDelete(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	sid := e2e.Itoa(f.Server.ID)

	_, jwt, _ := f.UserWithRole("manager", f.Server, permnames.RegistriesManage, "*")
	_, jwtNoPerm := f.User("no-perm")

	credExists := func(id uint) bool {
		t.Helper()
		var count int64
		require.NoError(t, app.DB.Model(&server.ServerRegistryCredential{}).Where("id = ?", id).Count(&count).Error)
		return count > 0
	}

	t.Run("unauthenticated returns 401 and the credential is not deleted", func(t *testing.T) {
		cred := seedRegistryCredential(t, app, f.Server.ID, "delete-unauth.example.com")
		credURL := "/api/v1/servers/" + sid + "/registries/" + e2e.Itoa(cred.ID)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: credURL}, "", 401)
		require.True(t, credExists(cred.ID), "credential should still exist after deny")
	})
	t.Run("JWT with registries.manage is admitted", func(t *testing.T) {
		cred := seedRegistryCredential(t, app, f.Server.ID, "delete-admit.example.com")
		credURL := "/api/v1/servers/" + sid + "/registries/" + e2e.Itoa(cred.ID)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: credURL}, bearer(jwt), 200)
		require.False(t, credExists(cred.ID), "credential should be deleted after admit")
	})
	t.Run("JWT without registries.manage returns 403 and the credential is not deleted", func(t *testing.T) {
		cred := seedRegistryCredential(t, app, f.Server.ID, "delete-deny.example.com")
		credURL := "/api/v1/servers/" + sid + "/registries/" + e2e.Itoa(cred.ID)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: credURL}, bearer(jwtNoPerm), 403)
		require.True(t, credExists(cred.ID), "credential should still exist after deny")
	})
}
