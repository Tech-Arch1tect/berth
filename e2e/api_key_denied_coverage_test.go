package e2e

import (
	"net/http"
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequireAPIKeyDeniedCoverage(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "apikey-denied-coverage",
		Email:    "apikey-denied-coverage@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	createResp, err := sessionClient.Post("/api/v1/api-keys", map[string]any{
		"name": "denied-coverage-key",
	})
	require.NoError(t, err)
	require.Equal(t, 201, createResp.StatusCode)

	var keyResp response.Response[apikey.CreateAPIKeyData]
	require.NoError(t, createResp.GetJSON(&keyResp))
	apiKey := keyResp.Data.PlainKey
	apiKeyID := keyResp.Data.APIKey.ID
	require.NotEmpty(t, apiKey)

	apiKeyRequest := func(method, path string, body any) *e2etesting.Response {
		opts := &e2etesting.RequestOptions{
			Method: method,
			Path:   path,
			Headers: map[string]string{
				"Authorization": "Bearer " + apiKey,
			},
		}
		if body != nil {
			opts.Body = body
		}
		resp, err := app.HTTPClient.Request(opts)
		require.NoError(t, err)
		return resp
	}

	keyID := itoa(apiKeyID)

	cases := []struct {
		name   string
		method string
		path   string
		body   any
	}{
		{"POST /api/v1/auth/logout", http.MethodPost, "/api/v1/auth/logout", map[string]any{}},
		{"GET /api/v1/totp/setup", http.MethodGet, "/api/v1/totp/setup", nil},
		{"POST /api/v1/totp/enable", http.MethodPost, "/api/v1/totp/enable", map[string]any{"code": "123456"}},
		{"POST /api/v1/totp/disable", http.MethodPost, "/api/v1/totp/disable", map[string]any{"code": "123456", "password": user.Password}},
		{"GET /api/v1/totp/status", http.MethodGet, "/api/v1/totp/status", nil},
		{"GET /api/v1/sessions", http.MethodGet, "/api/v1/sessions", nil},
		{"POST /api/v1/sessions/revoke", http.MethodPost, "/api/v1/sessions/revoke", map[string]any{"session_id": 1}},
		{"POST /api/v1/sessions/revoke-all-others", http.MethodPost, "/api/v1/sessions/revoke-all-others", map[string]any{}},
		{"GET /api/v1/api-keys", http.MethodGet, "/api/v1/api-keys", nil},
		{"POST /api/v1/api-keys", http.MethodPost, "/api/v1/api-keys", map[string]any{"name": "another"}},
		{"GET /api/v1/api-keys/:id", http.MethodGet, "/api/v1/api-keys/" + keyID, nil},
		{"DELETE /api/v1/api-keys/:id", http.MethodDelete, "/api/v1/api-keys/" + keyID, nil},
		{"GET /api/v1/api-keys/:id/scopes", http.MethodGet, "/api/v1/api-keys/" + keyID + "/scopes", nil},
		{"POST /api/v1/api-keys/:id/scopes", http.MethodPost, "/api/v1/api-keys/" + keyID + "/scopes", map[string]any{
			"server_id": 1, "stack_pattern": "*", "permission": "stacks.read",
		}},
		{"DELETE /api/v1/api-keys/:id/scopes/:scopeId", http.MethodDelete, "/api/v1/api-keys/" + keyID + "/scopes/1", nil},
	}

	for _, tc := range cases {
		t.Run(tc.name+" rejects API key auth", func(t *testing.T) {
			TagTest(t, tc.method, tc.path, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
			resp := apiKeyRequest(tc.method, tc.path, tc.body)
			assert.Equal(t, http.StatusForbidden, resp.StatusCode,
				"API key auth must be rejected with 403 by RequireAPIKeyDenied; got %d body=%s",
				resp.StatusCode, resp.GetString())
		})
	}
}

func TestCrossUserResourceAccess_APIKeys(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	userA := &e2etesting.TestUser{
		Username: "apikey-cross-user-a",
		Email:    "apikey-cross-user-a@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, userA)
	clientA := app.SessionHelper.SimulateLogin(t, app.AuthHelper, userA.Username, userA.Password)

	userB := &e2etesting.TestUser{
		Username: "apikey-cross-user-b",
		Email:    "apikey-cross-user-b@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, userB)
	clientB := app.SessionHelper.SimulateLogin(t, app.AuthHelper, userB.Username, userB.Password)

	createResp, err := clientB.Post("/api/v1/api-keys", map[string]any{
		"name": "b-only-key",
	})
	require.NoError(t, err)
	require.Equal(t, 201, createResp.StatusCode)

	var bKeyResp response.Response[apikey.CreateAPIKeyData]
	require.NoError(t, createResp.GetJSON(&bKeyResp))
	bKeyID := itoa(bKeyResp.Data.APIKey.ID)
	const dummyScopeID = "1"

	t.Run("user A cannot GET user B's key by ID", func(t *testing.T) {
		TagTest(t, http.MethodGet, "/api/v1/api-keys/:id", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Get("/api/v1/api-keys/" + bKeyID)
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode,
			"A reading B's key must 404 (not 200, not 403 — the resource isn't visible to A); body=%s", resp.GetString())
	})

	t.Run("user A cannot DELETE user B's key", func(t *testing.T) {
		TagTest(t, http.MethodDelete, "/api/v1/api-keys/:id", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Delete("/api/v1/api-keys/" + bKeyID)
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode,
			"A deleting B's key must 404; body=%s", resp.GetString())
	})

	t.Run("user A cannot list scopes of user B's key", func(t *testing.T) {
		TagTest(t, http.MethodGet, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Get("/api/v1/api-keys/" + bKeyID + "/scopes")
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode,
			"A listing scopes of B's key must 404; body=%s", resp.GetString())
	})

	t.Run("user A cannot add scope to user B's key", func(t *testing.T) {
		TagTest(t, http.MethodPost, "/api/v1/api-keys/:id/scopes", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Post("/api/v1/api-keys/"+bKeyID+"/scopes", map[string]any{
			"stack_pattern": "*",
			"permission":    "stacks.read",
		})
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusCreated, resp.StatusCode,
			"A adding scope to B's key must not succeed (201); got %d body=%s", resp.StatusCode, resp.GetString())
		assert.Contains(t, []int{http.StatusNotFound, http.StatusForbidden, http.StatusBadRequest}, resp.StatusCode,
			"expected 404/403/400, got %d", resp.StatusCode)
	})

	t.Run("user A cannot remove scope from user B's key", func(t *testing.T) {
		TagTest(t, http.MethodDelete, "/api/v1/api-keys/:id/scopes/:scopeId", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Delete("/api/v1/api-keys/" + bKeyID + "/scopes/" + dummyScopeID)
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode,
			"A removing scope from B's key must 404; body=%s", resp.GetString())
	})

	t.Run("user A's key list excludes user B's keys", func(t *testing.T) {
		TagTest(t, http.MethodGet, "/api/v1/api-keys", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Get("/api/v1/api-keys")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var listA response.Response[[]apikey.APIKeyInfo]
		require.NoError(t, resp.GetJSON(&listA))
		for _, k := range listA.Data {
			assert.NotEqual(t, bKeyResp.Data.APIKey.ID, k.ID,
				"A's key list must not contain B's key id %d", bKeyResp.Data.APIKey.ID)
		}
	})

	t.Run("user B's key still present in B's own list (control)", func(t *testing.T) {
		resp, err := clientB.Get("/api/v1/api-keys")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var listB response.Response[[]apikey.APIKeyInfo]
		require.NoError(t, resp.GetJSON(&listB))
		found := false
		for _, k := range listB.Data {
			if k.ID == bKeyResp.Data.APIKey.ID {
				found = true
				break
			}
		}
		assert.True(t, found, "B's own key list should include B's key (control assertion)")
	})
}

func TestCrossUserResourceAccess_Sessions(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	userA := &e2etesting.TestUser{
		Username: "session-cross-user-a",
		Email:    "session-cross-user-a@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, userA)
	clientA := app.SessionHelper.SimulateLogin(t, app.AuthHelper, userA.Username, userA.Password)

	userB := &e2etesting.TestUser{
		Username: "session-cross-user-b",
		Email:    "session-cross-user-b@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, userB)
	clientB := app.SessionHelper.SimulateLogin(t, app.AuthHelper, userB.Username, userB.Password)

	listResp, err := clientB.Get("/api/v1/sessions")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, listResp.StatusCode)

	type sessionItem struct {
		ID uint `json:"id"`
	}
	var sessionsB response.Response[struct {
		Sessions []sessionItem `json:"sessions"`
	}]
	require.NoError(t, listResp.GetJSON(&sessionsB))
	require.NotEmpty(t, sessionsB.Data.Sessions, "user B should have at least one tracked session")
	bSessionID := sessionsB.Data.Sessions[0].ID

	t.Run("user A cannot revoke user B's session by ID", func(t *testing.T) {
		TagTest(t, http.MethodPost, "/api/v1/sessions/revoke", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
		resp, err := clientA.Post("/api/v1/sessions/revoke", map[string]any{
			"session_id": bSessionID,
		})
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode,
			"A revoking B's session must not succeed; got %d body=%s", resp.StatusCode, resp.GetString())
		assert.Contains(t, []int{http.StatusNotFound, http.StatusForbidden}, resp.StatusCode,
			"expected 404/403, got %d body=%s", resp.StatusCode, resp.GetString())
	})

	t.Run("user A's session list excludes user B's sessions (control)", func(t *testing.T) {
		resp, err := clientA.Get("/api/v1/sessions")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var sessionsA response.Response[struct {
			Sessions []sessionItem `json:"sessions"`
		}]
		require.NoError(t, resp.GetJSON(&sessionsA))
		for _, s := range sessionsA.Data.Sessions {
			assert.NotEqual(t, bSessionID, s.ID,
				"A's session list must not contain B's session id %d", bSessionID)
		}
	})

	t.Run("user B's session still revokable by B (control)", func(t *testing.T) {
		resp, err := clientB.Post("/api/v1/sessions/revoke", map[string]any{
			"session_id": bSessionID,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode,
			"B revoking B's own session should succeed (control); got %d body=%s", resp.StatusCode, resp.GetString())
	})
}
