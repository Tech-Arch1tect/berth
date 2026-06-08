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

func countServers(t *testing.T, app *e2e.TestApp) int {
	t.Helper()
	var n int64
	require.NoError(t, app.DB.Model(&server.Server{}).Count(&n).Error)
	return int(n)
}

func serverName(t *testing.T, app *e2e.TestApp, id uint) string {
	t.Helper()
	var s server.Server
	require.NoError(t, app.DB.First(&s, id).Error)
	return s.Name
}

func serverExists(t *testing.T, app *e2e.TestApp, id uint) bool {
	t.Helper()
	var n int64
	require.NoError(t, app.DB.Model(&server.Server{}).Where("id = ?", id).Count(&n).Error)
	return n > 0
}

func TestAuthzAdminServersList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	const url = "/api/v1/admin/servers"

	_, jwtAdmin := f.Admin("read-admin")
	_, jwtNonAdmin := f.User("non-admin")

	adminOwner, _ := f.Admin("key-owner")
	keyNoScope := f.APIKeyFor(adminOwner, "noscope-key", nil)
	keyRead := f.APIKeyFor(adminOwner, "read-key", []ScopeSpec{
		{Permission: permnames.AdminServersRead, StackPattern: "*"},
	})
	keyWrite := f.APIKeyFor(adminOwner, "write-key", []ScopeSpec{
		{Permission: permnames.AdminServersWrite, StackPattern: "*"},
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, "", 401)
	})
	t.Run("non-admin JWT returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtNonAdmin), 403)
	})
	t.Run("admin JWT is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtAdmin), 200)
	})
	t.Run("admin API key without an admin scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyNoScope), 403)
	})
	t.Run("admin API key with admin.servers.read scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyRead), 200)
	})
	t.Run("admin API key with only admin.servers.write scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyWrite), 403)
	})
}

func TestAuthzAdminServerGet(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	url := "/api/v1/admin/servers/" + e2e.Itoa(f.Server.ID)

	_, jwtAdmin := f.Admin("read-admin")
	_, jwtNonAdmin := f.User("non-admin")

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, "", 401)
	})
	t.Run("non-admin JWT returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtNonAdmin), 403)
	})
	t.Run("admin JWT is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtAdmin), 200)
	})
}

func TestAuthzAdminServerCreate(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	const url = "/api/v1/admin/servers"

	newServerBody := func(suffix string) map[string]any {
		return map[string]any{
			"name":         "admin-srv-" + suffix,
			"host":         "192.0.2." + suffix,
			"port":         2375,
			"access_token": "tok-" + suffix,
		}
	}

	assertNoServerCreated := func(t *testing.T, before int) {
		t.Helper()
		require.Equal(t, before, countServers(t, app), "server count changed on a denied create")
	}

	_, jwtAdmin := f.Admin("write-admin")
	_, jwtNonAdmin := f.User("non-admin")

	adminOwner, _ := f.Admin("key-owner")
	keyNoScope := f.APIKeyFor(adminOwner, "noscope-key", nil)
	keyRead := f.APIKeyFor(adminOwner, "read-key", []ScopeSpec{
		{Permission: permnames.AdminServersRead, StackPattern: "*"},
	})
	keyWrite := f.APIKeyFor(adminOwner, "write-key", []ScopeSpec{
		{Permission: permnames.AdminServersWrite, StackPattern: "*"},
	})

	t.Run("unauthenticated returns 401 and creates no server", func(t *testing.T) {
		before := countServers(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("unauth")}, "", 401)
		assertNoServerCreated(t, before)
	})
	t.Run("non-admin JWT returns 403 and creates no server", func(t *testing.T) {
		before := countServers(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("nonadmin")}, bearer(jwtNonAdmin), 403)
		assertNoServerCreated(t, before)
	})
	t.Run("admin JWT is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("admin-jwt")}, bearer(jwtAdmin), 201)
	})
	t.Run("admin API key without an admin scope returns 403 and creates no server", func(t *testing.T) {
		before := countServers(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("noscope")}, bearer(keyNoScope), 403)
		assertNoServerCreated(t, before)
	})
	t.Run("admin API key with only admin.servers.read scope returns 403 and creates no server", func(t *testing.T) {
		before := countServers(t, app)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("readkey")}, bearer(keyRead), 403)
		assertNoServerCreated(t, before)
	})
	t.Run("admin API key with admin.servers.write scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url, Body: newServerBody("writekey")}, bearer(keyWrite), 201)
	})
}

func TestAuthzAdminServerWriteSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	_, jwtAdmin := f.Admin("write-admin")
	_, jwtNonAdmin := f.User("non-admin")

	updateBody := map[string]any{
		"name":         "renamed",
		"host":         "192.0.2.50",
		"port":         2375,
		"access_token": "rotated-token",
	}

	t.Run("PUT", func(t *testing.T) {
		t.Run("unauthenticated returns 401 and the server is unchanged", func(t *testing.T) {
			srv, _ := f.AddServer("put-unauth")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: url, Body: updateBody}, "", 401)
			require.Equal(t, srv.Name, serverName(t, app, srv.ID))
		})
		t.Run("non-admin JWT returns 403 and the server is unchanged", func(t *testing.T) {
			srv, _ := f.AddServer("put-nonadmin")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: url, Body: updateBody}, bearer(jwtNonAdmin), 403)
			require.Equal(t, srv.Name, serverName(t, app, srv.ID))
		})
		t.Run("admin JWT is admitted", func(t *testing.T) {
			srv, _ := f.AddServer("put-admin")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPut, Path: url, Body: updateBody}, bearer(jwtAdmin), 200)
		})
	})

	t.Run("DELETE", func(t *testing.T) {
		t.Run("unauthenticated returns 401 and the server still exists", func(t *testing.T) {
			srv, _ := f.AddServer("del-unauth")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: url}, "", 401)
			require.True(t, serverExists(t, app, srv.ID))
		})
		t.Run("non-admin JWT returns 403 and the server still exists", func(t *testing.T) {
			srv, _ := f.AddServer("del-nonadmin")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: url}, bearer(jwtNonAdmin), 403)
			require.True(t, serverExists(t, app, srv.ID))
		})
		t.Run("admin JWT is admitted and the server is deleted", func(t *testing.T) {
			srv, _ := f.AddServer("del-admin")
			url := "/api/v1/admin/servers/" + e2e.Itoa(srv.ID)
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: url}, bearer(jwtAdmin), 200)
			require.False(t, serverExists(t, app, srv.ID))
		})
	})

	t.Run("test connection", func(t *testing.T) {
		url := "/api/v1/admin/servers/" + e2e.Itoa(f.Server.ID) + "/test"
		t.Run("unauthenticated returns 401 with no connection attempt", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodGet, "/health")
		})
		t.Run("non-admin JWT returns 403 with no connection attempt", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url}, bearer(jwtNonAdmin), 403)
			f.Agent.AssertNotCalled(t, http.MethodGet, "/health")
		})
		t.Run("admin JWT is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: url}, bearer(jwtAdmin), 200)
		})
	})
}
