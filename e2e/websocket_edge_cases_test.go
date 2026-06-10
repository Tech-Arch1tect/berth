package e2e

import (
	"net/http"
	"testing"
	"time"

	"berth/internal/domain/apikey"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const wsStackEventsPath = "/ws/api/servers/1/stacks/test-stack/events"

func wsAuthRequest(t *testing.T, app *TestApp, headers map[string]string) *e2etesting.Response {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    wsStackEventsPath,
		Headers: headers,
	})
	require.NoError(t, err)
	return resp
}

func TestWebSocketExpiredJWTRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "ws_expired_jwt",
		Email:    "ws_expired_jwt@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	issuer := app.Config.JWT.Issuer
	expired := signHS256(t, app.Config.JWT.SecretKey,
		accessClaims(user.ID, issuer, issuer, time.Now().Add(-time.Hour)))

	t.Run("via Authorization header", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		resp := wsAuthRequest(t, app, map[string]string{"Authorization": "Bearer " + expired})
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})

	t.Run("via Sec-WebSocket-Protocol", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		resp := wsAuthRequest(t, app, map[string]string{"Sec-WebSocket-Protocol": "Bearer, " + expired})
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})
}

func TestWebSocketRevokedJWTRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	login := apiLogin(t, app, "ws_revoked_jwt", "ws_revoked_jwt@example.com", "password123")
	require.Equal(t, 200, apiLogout(t, app, login.Data.AccessToken, login.Data.RefreshToken))

	t.Run("via Authorization header", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		resp := wsAuthRequest(t, app, map[string]string{"Authorization": "Bearer " + login.Data.AccessToken})
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})

	t.Run("via Sec-WebSocket-Protocol", func(t *testing.T) {
		TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		resp := wsAuthRequest(t, app, map[string]string{"Sec-WebSocket-Protocol": "Bearer, " + login.Data.AccessToken})
		assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
	})
}

func TestWebSocketInactiveAPIKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "ws_inactive_key",
		Email:    "ws_inactive_key@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	keyID, plainKey := createKeyFor(t, session, "ws-inactive-key")
	require.NoError(t, app.DB.Model(&apikey.APIKey{}).Where("id = ?", keyID).Update("is_active", false).Error)

	TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
	resp := wsAuthRequest(t, app, map[string]string{"Authorization": "Bearer " + plainKey})
	assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
}

func TestWebSocketExpiredAPIKeyRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "ws_expired_key",
		Email:    "ws_expired_key@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	keyID, plainKey := createKeyFor(t, session, "ws-expired-key")
	require.NoError(t, app.DB.Model(&apikey.APIKey{}).Where("id = ?", keyID).
		Update("expires_at", time.Now().Add(-time.Hour)).Error)

	TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
	resp := wsAuthRequest(t, app, map[string]string{"Authorization": "Bearer " + plainKey})
	assertJSONEnvelope(t, resp, 401, "unauthorized", "Authentication failed")
}

func TestWebSocketInsufficientAccessDeniedAfterAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "ws_no_access",
		Email:    "ws_no_access@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	session := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	_, plainKey := createKeyFor(t, session, "ws-no-access-key")

	_, testServer := app.CreateTestServerWithAgent(t, "ws-no-access-server")

	TagTest(t, "GET", "/ws/api/servers/:serverid/stacks/:stackname/events", e2etesting.CategorySecurity, e2etesting.ValueHigh)
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    "/ws/api/servers/" + Itoa(testServer.ID) + "/stacks/test-stack/events",
		Headers: map[string]string{"Authorization": "Bearer " + plainKey},
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode,
		"a valid key authenticates, but the route middleware must still deny a stack the key has no scope for; body=%s", resp.GetString())
}
