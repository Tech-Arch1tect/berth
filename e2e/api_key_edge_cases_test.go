package e2e

import (
	"net/http"
	"testing"
	"time"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIKeyScopeValidation_RejectsBadStackPatterns(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-bad-pattern",
		Email:    "apikey-bad-pattern@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	keyID, _ := createKeyFor(t, session, "bad-pattern-key")

	cases := []struct {
		name    string
		pattern string
	}{
		{"empty pattern", ""},
		{"embedded space", "prod stack"},
		{"glob question mark", "prod?"},
		{"shell metacharacter", "prod$"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryValidation, e2etesting.ValueMedium)
			resp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
				"stack_pattern": tc.pattern,
				"permission":    "stacks.read",
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
				"stack pattern %q must be rejected at creation; body=%s", tc.pattern, resp.GetString())
		})
	}
}

func TestAPIKeyScopeGrant_DuplicateScopeRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-dup-scope",
		Email:    "apikey-dup-scope@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	_, testServer := app.CreateTestServerWithAgent(t, "dup-scope-server")
	keyID, _ := createKeyFor(t, session, "dup-scope-key")

	scope := map[string]any{
		"server_id":     testServer.ID,
		"stack_pattern": "*",
		"permission":    "stacks.read",
	}

	first, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", scope)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, first.StatusCode, "first grant should succeed; body=%s", first.GetString())

	TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryValidation, e2etesting.ValueMedium)
	second, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", scope)
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, second.StatusCode,
		"granting an identical scope twice must be rejected; body=%s", second.GetString())
	assert.Contains(t, second.GetString(), "already exists")
}

func TestAPIKeyLifecycle_WhitespaceInTokenRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-whitespace",
		Email:    "apikey-whitespace@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	_, plainKey := createKeyFor(t, session, "whitespace-key")

	cases := []struct {
		name string
		key  string
	}{
		{"leading space on token", " " + plainKey},
		{"space inside token", plainKey[:8] + " " + plainKey[8:]},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
			resp := authedGet(t, app, "/api/v1/profile", tc.key)
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
				"a key with stray whitespace must not authenticate; body=%s", resp.GetString())
		})
	}
}

func TestAPIKeyScopeRuntime_SoftDeletedPermissionHandledGracefully(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-deleted-perm",
		Email:    "apikey-deleted-perm@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "deleted-perm-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})

	keyID, plainKey := createKeyFor(t, session, "deleted-perm-key")
	scopeResp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"server_id":     testServer.ID,
		"stack_pattern": "*",
		"permission":    "stacks.read",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, scopeResp.StatusCode)

	require.NoError(t, app.DB.Exec("UPDATE permissions SET deleted_at = ? WHERE name = ?",
		time.Now(), "stacks.read").Error)

	TagTest(t, http.MethodGet, "/api/v1/servers/:id/stacks", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

	profileResp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.NotEqual(t, http.StatusInternalServerError, profileResp.StatusCode,
		"a scope pointing at a soft-deleted permission must not crash authentication; body=%s", profileResp.GetString())

	stacksResp := authedGet(t, app, "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
	assert.NotEqual(t, http.StatusInternalServerError, stacksResp.StatusCode,
		"a soft-deleted permission must fail the scope check gracefully, not panic; body=%s", stacksResp.GetString())
}

func TestAPIKeyScopeRuntime_ServerScopedKeyDeniedAfterAccessLoss(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-access-loss",
		Email:    "apikey-access-loss@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "access-loss-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})

	keyID, plainKey := createKeyFor(t, session, "access-loss-key")
	scopeResp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"server_id":     testServer.ID,
		"stack_pattern": "*",
		"permission":    "stacks.read",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, scopeResp.StatusCode)

	stacksPath := "/api/v1/servers/" + itoa(testServer.ID) + "/stacks"
	require.Equal(t, http.StatusOK, authedGet(t, app, stacksPath, plainKey).StatusCode,
		"control: the scoped key reads the server's stacks while the granting user has access")

	require.NoError(t, app.DB.Exec("DELETE FROM user_roles WHERE user_id = ?", user.ID).Error)

	TagTest(t, http.MethodGet, "/api/v1/servers/:id/stacks", e2etesting.CategorySecurity, e2etesting.ValueHigh)
	resp := authedGet(t, app, stacksPath, plainKey)
	assert.NotEqual(t, http.StatusOK, resp.StatusCode,
		"a server-scoped key must be denied once the granting user loses access to that server — RBAC is re-checked at request time, not snapshotted at scope-grant; body=%s", resp.GetString())
}
