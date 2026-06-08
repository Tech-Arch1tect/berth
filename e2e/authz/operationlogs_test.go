package authz

import (
	"net/http"
	"testing"
	"time"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/rbac/permnames"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedOperationLog(t *testing.T, app *e2e.TestApp, userID, serverID uint, operationID string) {
	t.Helper()
	row := &operationlogs.OperationLog{
		UserID:      userID,
		ServerID:    serverID,
		StackName:   "prod-web",
		OperationID: operationID,
		Command:     "up",
		StartTime:   time.Now(),
	}
	require.NoError(t, app.DB.Create(row).Error, "seed operation log")
}

func operationLogIDs(t *testing.T, app *e2e.TestApp, path, authHeader string) []string {
	t.Helper()
	opts := &e2etesting.RequestOptions{Method: http.MethodGet, Path: path}
	if authHeader != "" {
		opts.Headers = map[string]string{"Authorization": authHeader}
	}
	resp, err := app.HTTPClient.Request(opts)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode, "GET %s body=%s", path, resp.GetString())
	var body struct {
		Data []struct {
			OperationID string `json:"operation_id"`
		} `json:"data"`
	}
	require.NoError(t, resp.GetJSON(&body))
	ids := make([]string, 0, len(body.Data))
	for _, d := range body.Data {
		ids = append(ids, d.OperationID)
	}
	return ids
}

func TestAuthzOperationLogsUserList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	const url = "/api/v1/operation-logs"

	caller, jwtUser := f.User("user")
	other, _ := f.User("other")
	seedOperationLog(t, app, caller.ID, f.Server.ID, "caller-op")
	seedOperationLog(t, app, other.ID, f.Server.ID, "other-op")

	_, jwtAdmin := f.Admin("read-admin")

	noScopeOwner, _ := f.User("noscope-owner")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	scopedOwner, _ := f.User("scoped-owner")
	keyScoped := f.APIKeyFor(scopedOwner, "scoped-key", []ScopeSpec{
		{Permission: permnames.LogsOperationsRead, StackPattern: "*"},
	})

	wrongScopeOwner, _ := f.User("wrongscope-owner")
	keyWrongScope := f.APIKeyFor(wrongScopeOwner, "wrongscope-key", []ScopeSpec{
		{Permission: permnames.ServersRead, StackPattern: "*"},
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, "", 401)
	})
	t.Run("JWT is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtUser), 200)
	})
	t.Run("JWT admin is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(jwtAdmin), 200)
	})
	t.Run("API key without logs.operations.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyNoScope), 403)
	})
	t.Run("API key with a different permission scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyWrongScope), 403)
	})
	t.Run("API key with logs.operations.read scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyScoped), 200)
	})
	t.Run("JWT sees only the caller's own operation logs", func(t *testing.T) {
		ids := operationLogIDs(t, app, url, bearer(jwtUser))
		assert.Contains(t, ids, "caller-op")
		assert.NotContains(t, ids, "other-op")
	})
}

func TestAuthzOperationLogsUserSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	_, jwt := f.User("user")
	noScopeOwner, _ := f.User("noscope-owner")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	siblings := []struct {
		name        string
		path        string
		admitStatus int
	}{
		{"stats", "/api/v1/operation-logs/stats", 200},
		{"running operations", "/api/v1/running-operations", 200},
		{"detail by id", "/api/v1/operation-logs/99999", 404},
		{"detail by operation id", "/api/v1/operation-logs/by-operation-id/does-not-exist", 404},
	}
	for _, s := range siblings {
		t.Run(s.name, func(t *testing.T) {
			t.Run("unauthenticated returns 401", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, "", 401)
			})
			t.Run("JWT is admitted", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, bearer(jwt), s.admitStatus)
			})
			t.Run("API key without logs.operations.read scope returns 403", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, bearer(keyNoScope), 403)
			})
		})
	}
}

func TestAuthzOperationLogsAdminList(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	const url = "/api/v1/admin/operation-logs"

	userA, _ := f.User("user-a")
	userB, _ := f.User("user-b")
	seedOperationLog(t, app, userA.ID, f.Server.ID, "a-op")
	seedOperationLog(t, app, userB.ID, f.Server.ID, "b-op")

	_, jwtAdmin := f.Admin("list-admin")
	_, jwtNonAdmin := f.User("non-admin")

	adminOwner, _ := f.Admin("key-admin-owner")
	keyNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)
	keyScoped := f.APIKeyFor(adminOwner, "admin-scoped-key", []ScopeSpec{
		{Permission: permnames.AdminLogsRead, StackPattern: "*"},
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
	t.Run("admin API key without admin.logs.read scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyNoScope), 403)
	})
	t.Run("admin API key with admin.logs.read scope is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: url}, bearer(keyScoped), 200)
	})
	t.Run("admin sees operation logs across all users", func(t *testing.T) {
		ids := operationLogIDs(t, app, url, bearer(jwtAdmin))
		assert.Contains(t, ids, "a-op")
		assert.Contains(t, ids, "b-op")
	})
}

func TestAuthzOperationLogsAdminSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	_, jwtAdmin := f.Admin("sib-admin")
	_, jwtNonAdmin := f.User("non-admin")

	siblings := []struct {
		name        string
		path        string
		admitStatus int
	}{
		{"stats", "/api/v1/admin/operation-logs/stats", 200},
		{"detail by id", "/api/v1/admin/operation-logs/99999", 404},
	}
	for _, s := range siblings {
		t.Run(s.name, func(t *testing.T) {
			t.Run("unauthenticated returns 401", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, "", 401)
			})
			t.Run("non-admin JWT returns 403", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, bearer(jwtNonAdmin), 403)
			})
			t.Run("admin JWT is admitted", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: s.path}, bearer(jwtAdmin), s.admitStatus)
			})
		})
	}
}
