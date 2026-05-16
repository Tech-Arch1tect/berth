package e2e

import (
	"net/http"
	"testing"
	"time"

	"berth/internal/domain/apikey"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createKeyFor(t *testing.T, sessionClient *e2etesting.HTTPClient, name string) (uint, string) {
	t.Helper()
	resp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{"name": name})
	require.NoError(t, err)
	require.Equal(t, 201, resp.StatusCode)
	var body response.Response[apikey.CreateAPIKeyData]
	require.NoError(t, resp.GetJSON(&body))
	return body.Data.APIKey.ID, body.Data.PlainKey
}

func authedGet(t *testing.T, app *TestApp, path, key string) *e2etesting.Response {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    path,
		Headers: map[string]string{"Authorization": "Bearer " + key},
	})
	require.NoError(t, err)
	return resp
}

func TestAPIKeyLifecycle_HappyPathAuthSucceeds(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-happy-path", Email: "apikey-happy-path@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	_, plainKey := createKeyFor(t, session, "happy-key")
	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusOK, resp.StatusCode, "valid key on a non-RequireAPIKeyDenied endpoint should authenticate; body=%s", resp.GetString())
}

func TestAPIKeyLifecycle_InactiveKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-inactive", Email: "apikey-inactive@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, plainKey := createKeyFor(t, session, "inactive-key")
	require.NoError(t, app.DB.Model(&apikey.APIKey{}).Where("id = ?", keyID).Update("is_active", false).Error)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueHigh)
	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "inactive API key must 401; body=%s", resp.GetString())
}

func TestAPIKeyLifecycle_ExpiredKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-expired", Email: "apikey-expired@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, plainKey := createKeyFor(t, session, "expired-key")
	pastTime := time.Now().Add(-time.Hour)
	require.NoError(t, app.DB.Model(&apikey.APIKey{}).Where("id = ?", keyID).Update("expires_at", pastTime).Error)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueHigh)
	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "expired API key must 401; body=%s", resp.GetString())
}

func TestAPIKeyLifecycle_SoftDeletedKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-soft-deleted", Email: "apikey-soft-deleted@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, plainKey := createKeyFor(t, session, "doomed-key")

	deleteResp, err := session.Delete("/api/v1/api-keys/" + itoa(keyID))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, deleteResp.StatusCode)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueHigh)
	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
		"revoked (soft-deleted with hash rename) API key must 401; body=%s", resp.GetString())
}

func TestAPIKeyLifecycle_WrongPrefixRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-wrong-prefix", Email: "apikey-wrong-prefix@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	_, plainKey := createKeyFor(t, session, "prefix-key")
	bodyOfKey := plainKey[len(apikey.KeyPrefix):]

	cases := []struct {
		name string
		key  string
	}{
		{"hyphen instead of underscore", "brth-" + bodyOfKey},
		{"no separator", "brth" + bodyOfKey},
		{"capitalised prefix", "Brth_" + bodyOfKey},
		{"all caps prefix", "BRTH_" + bodyOfKey},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
			resp := authedGet(t, app, "/api/v1/profile", tc.key)
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
				"wrong-prefix key %q must 401; body=%s", tc.key, resp.GetString())
		})
	}
}

func TestAPIKeyLifecycle_UnrecognisedHashRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
	bogus := apikey.KeyPrefix + "this-is-not-a-real-key-just-random-bytes-1234567890abcdef"
	resp := authedGet(t, app, "/api/v1/profile", bogus)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
		"valid-prefix but unknown-hash key must 401; body=%s", resp.GetString())
}

func TestAPIKeyLifecycle_LastUsedAtUpdates(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-last-used", Email: "apikey-last-used@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, plainKey := createKeyFor(t, session, "lastused-key")

	var before apikey.APIKey
	require.NoError(t, app.DB.First(&before, keyID).Error)
	require.Nil(t, before.LastUsedAt, "newly-created key should have nil LastUsedAt")

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var after apikey.APIKey
	require.NoError(t, app.DB.First(&after, keyID).Error)
	require.NotNil(t, after.LastUsedAt, "LastUsedAt must be populated after a successful auth")
	assert.WithinDuration(t, time.Now(), *after.LastUsedAt, 5*time.Second,
		"LastUsedAt should be set to ~now")
}

func TestAPIKeyLifecycle_SoftDeletedUserKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	user := &e2etesting.TestUser{Username: "apikey-deleted-user", Email: "apikey-deleted-user@example.com", Password: "password123"}
	app.AuthHelper.CreateTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	_, plainKey := createKeyFor(t, session, "deleted-user-key")
	require.Equal(t, http.StatusOK, authedGet(t, app, "/api/v1/profile", plainKey).StatusCode,
		"control: the key authenticates while the user exists")

	require.NoError(t, app.DB.Exec("UPDATE users SET deleted_at = ? WHERE id = ?", time.Now(), user.ID).Error)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
	resp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
		"a soft-deleted user's API key must no longer authenticate; body=%s", resp.GetString())
}

func TestAPIKeyScopeGrant_RejectsServerWithoutAccess(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	nonAdmin := &e2etesting.TestUser{
		Username: "scopegrant-no-server-access",
		Email:    "scopegrant-no-server-access@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, nonAdmin)
	nonAdminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, nonAdmin.Username, nonAdmin.Password)

	_, testServer := app.CreateTestServerWithAgent(t, "scope-grant-server")

	keyID, _ := createKeyFor(t, nonAdminClient, "non-admin-key")

	TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
	resp, err := nonAdminClient.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"server_id":     testServer.ID,
		"stack_pattern": "*",
		"permission":    "stacks.read",
	})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusCreated, resp.StatusCode,
		"non-admin without access to the server must not be able to grant a scope on it; got %d body=%s", resp.StatusCode, resp.GetString())
	assert.Contains(t, []int{http.StatusBadRequest, http.StatusForbidden, http.StatusNotFound}, resp.StatusCode,
		"expected 4xx, got %d", resp.StatusCode)
}

func TestAPIKeyScopeGrant_NonAdminCannotGrantAdminScope(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{Username: "scopegrant-non-admin", Email: "scopegrant-non-admin@example.com", Password: "password123"}
	app.AuthHelper.CreateTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, _ := createKeyFor(t, session, "user-key")

	TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
	resp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"stack_pattern": "*",
		"permission":    "admin.users.read",
	})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusCreated, resp.StatusCode,
		"non-admin must not be able to grant admin.* scope; got %d body=%s", resp.StatusCode, resp.GetString())
	body := resp.GetString()
	assert.Contains(t, body, "admin",
		"error body should reference admin role requirement; got %s", body)
}

func TestAPIKeyScopeGrant_AllServersRequiresAtLeastOneAccessibleServer(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{Username: "scopegrant-no-servers", Email: "scopegrant-no-servers@example.com", Password: "password123"}
	app.AuthHelper.CreateTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, _ := createKeyFor(t, session, "no-server-key")

	TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
	resp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"stack_pattern": "*",
		"permission":    "stacks.read",
	})
	require.NoError(t, err)
	assert.NotEqual(t, http.StatusCreated, resp.StatusCode,
		"user with no accessible servers must not be able to grant an 'all servers' scope; got %d body=%s", resp.StatusCode, resp.GetString())
}

func TestAPIKeyScopeRuntime_KeyForSoftDeletedServerStillAuthenticatesButDeniesAccess(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{Username: "scoperuntime-server-deleted", Email: "scoperuntime-server-deleted@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "to-delete-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]any{})

	keyID, plainKey := createKeyFor(t, session, "server-scoped-key")
	scopeResp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"server_id":     testServer.ID,
		"stack_pattern": "*",
		"permission":    "stacks.read",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, scopeResp.StatusCode)

	delResp, err := session.Delete("/api/v1/admin/servers/" + itoa(testServer.ID))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, delResp.StatusCode)

	TagTest(t, http.MethodGet, "/api/v1/profile", e2etesting.CategoryEdgeCase, e2etesting.ValueMedium)

	profileResp := authedGet(t, app, "/api/v1/profile", plainKey)
	assert.Equal(t, http.StatusOK, profileResp.StatusCode,
		"key authentication should still work even though the scoped server is soft-deleted (auth is per-key, not per-scope-target)")

	stacksResp := authedGet(t, app, "/api/v1/servers/"+itoa(testServer.ID)+"/stacks", plainKey)
	assert.NotEqual(t, http.StatusOK, stacksResp.StatusCode,
		"accessing a soft-deleted server must not succeed; got %d body=%s", stacksResp.StatusCode, stacksResp.GetString())
}

func TestAPIKeyScopeRuntime_AdminScopedKeyDeniedAfterRoleRemoval(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{Username: "scoperuntime-ex-admin", Email: "scoperuntime-ex-admin@example.com", Password: "password123"}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	keyID, plainKey := createKeyFor(t, session, "ex-admin-key")
	scopeResp, err := session.Post("/api/v1/api-keys/"+itoa(keyID)+"/scopes", map[string]any{
		"stack_pattern": "*",
		"permission":    "admin.users.read",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, scopeResp.StatusCode,
		"admin user should be allowed to grant admin.users.read scope; body=%s", scopeResp.GetString())

	require.NoError(t, app.DB.Exec("DELETE FROM user_roles WHERE user_id = ?", user.ID).Error)

	TagTest(t, http.MethodGet, "/api/v1/admin/users", e2etesting.CategorySecurity, e2etesting.ValueHigh)

	resp := authedGet(t, app, "/api/v1/admin/users", plainKey)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode,
		"admin-scoped key must be DENIED on admin endpoints once the granting user loses admin role — RBAC is re-checked at request time, not snapshotted at scope-grant. Locks in the security-conscious semantic. body=%s", resp.GetString())
}
