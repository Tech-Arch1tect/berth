package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAuditServerLifecycle(t *testing.T) {
	app := SetupTestApp(t)

	admin := &e2etesting.TestUser{
		Username: "audit-server-admin",
		Email:    "audit-server-admin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, admin)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{Username: admin.Username, Password: admin.Password})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)
	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	auth := func(method, path string, body map[string]any) *e2etesting.Response {
		t.Helper()
		resp, reqErr := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method:  method,
			Path:    path,
			Body:    body,
			Headers: map[string]string{"Authorization": "Bearer " + token, "Content-Type": "application/json"},
		})
		require.NoError(t, reqErr)
		return resp
	}

	var serverID uint

	t.Run("create records server.created", func(t *testing.T) {
		resp := auth("POST", "/api/v1/admin/servers", map[string]any{
			"name": "audit-srv", "host": "test.invalid", "port": 8080,
			"skip_ssl_verification": true, "access_token": "tok", "is_active": true,
		})
		require.Equal(t, 201, resp.StatusCode)
		var created response.Response[server.AdminCreateServerData]
		require.NoError(t, resp.GetJSON(&created))
		serverID = created.Data.Server.ID
		require.NotZero(t, serverID)

		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerCreated))
	})

	t.Run("update with a new token records server.updated and access_token.regenerated", func(t *testing.T) {
		require.NotZero(t, serverID)
		resp := auth("PUT", "/api/v1/admin/servers/"+Itoa(serverID), map[string]any{
			"name": "audit-srv-2", "host": "test.invalid", "port": 8080,
			"skip_ssl_verification": true, "access_token": "rotated-tok", "is_active": true,
		})
		require.Equal(t, 200, resp.StatusCode)

		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerUpdated))
		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerAccessTokenRegenerated),
			"supplying a new access token must record a token-regeneration event")
	})

	t.Run("update without a token does not record another regeneration", func(t *testing.T) {
		require.NotZero(t, serverID)
		resp := auth("PUT", "/api/v1/admin/servers/"+Itoa(serverID), map[string]any{
			"name": "audit-srv-3", "host": "test.invalid", "port": 8080,
			"skip_ssl_verification": true, "is_active": true,
		})
		require.Equal(t, 200, resp.StatusCode)

		assert.Equal(t, int64(2), countAuditEvents(t, app.DB, security.EventServerUpdated))
		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerAccessTokenRegenerated),
			"an update with no new token must not record a regeneration")
	})

	t.Run("failed connection test records connection.test_failure", func(t *testing.T) {
		require.NotZero(t, serverID)
		resp := auth("POST", "/api/v1/admin/servers/"+Itoa(serverID)+"/test", map[string]any{})
		require.Equal(t, 503, resp.StatusCode, "unreachable host must fail the connection test")

		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerConnectionTestFailure))
		assert.Zero(t, countAuditEvents(t, app.DB, security.EventServerConnectionTestSuccess))
	})

	t.Run("delete records server.deleted", func(t *testing.T) {
		require.NotZero(t, serverID)
		resp := auth("DELETE", "/api/v1/admin/servers/"+Itoa(serverID), nil)
		require.Equal(t, 200, resp.StatusCode)

		assert.Equal(t, int64(1), countAuditEvents(t, app.DB, security.EventServerDeleted))
	})
}

func countAuditEvents(t *testing.T, db *gorm.DB, eventType string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&security.SecurityAuditLog{}).
		Where("event_type = ?", eventType).Count(&n).Error)
	return n
}
