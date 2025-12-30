package e2e

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type AuditLogsListResponse struct {
	Logs       []AuditLogEntry `json:"logs"`
	Total      int64           `json:"total"`
	Page       int             `json:"page"`
	PerPage    int             `json:"per_page"`
	TotalPages int             `json:"total_pages"`
}

type AuditLogEntry struct {
	ID            uint   `json:"id"`
	CreatedAt     string `json:"created_at"`
	EventType     string `json:"event_type"`
	EventCategory string `json:"event_category"`
	Severity      string `json:"severity"`
	ActorUserID   *uint  `json:"actor_user_id"`
	ActorUsername string `json:"actor_username"`
	ActorIP       string `json:"actor_ip"`
	Success       bool   `json:"success"`
	FailureReason string `json:"failure_reason"`
	ServerID      *uint  `json:"server_id"`
	StackName     string `json:"stack_name"`
}

type AuditStatsResponse struct {
	TotalEvents       int64            `json:"total_events"`
	EventsByCategory  map[string]int64 `json:"events_by_category"`
	EventsBySeverity  map[string]int64 `json:"events_by_severity"`
	FailedEvents      int64            `json:"failed_events"`
	RecentEventTypes  []EventTypeCount `json:"recent_event_types"`
	EventsLast24Hours int64            `json:"events_last_24_hours"`
	EventsLast7Days   int64            `json:"events_last_7_days"`
}

type EventTypeCount struct {
	EventType string `json:"event_type"`
	Count     int64  `json:"count"`
}

func TestSecurityAuditLogsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "audituser",
		Email:    "audituser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/security-audit-logs returns paginated logs", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp AuditLogsListResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		assert.GreaterOrEqual(t, logsResp.Total, int64(1))
		assert.Equal(t, 1, logsResp.Page)
		assert.Equal(t, 50, logsResp.PerPage)
	})

	t.Run("GET /api/v1/admin/security-audit-logs supports pagination", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs?page=1&per_page=5",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp AuditLogsListResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		assert.Equal(t, 5, logsResp.PerPage)
		assert.LessOrEqual(t, len(logsResp.Logs), 5)
	})

	t.Run("GET /api/v1/admin/security-audit-logs supports filtering by event_type", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs?event_type=api.token.issued",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp AuditLogsListResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		for _, log := range logsResp.Logs {
			assert.Equal(t, "api.token.issued", log.EventType)
		}
	})

	t.Run("GET /api/v1/admin/security-audit-logs supports filtering by success", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs?success=true",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logsResp AuditLogsListResponse
		require.NoError(t, resp.GetJSON(&logsResp))
		for _, log := range logsResp.Logs {
			assert.True(t, log.Success)
		}
	})
}

func TestSecurityAuditStatsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "auditstatsuser",
		Email:    "auditstatsuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/security-audit-logs/stats returns statistics", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs/stats",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var statsResp AuditStatsResponse
		require.NoError(t, resp.GetJSON(&statsResp))
		assert.GreaterOrEqual(t, statsResp.TotalEvents, int64(1))
		assert.NotNil(t, statsResp.EventsByCategory)
		assert.NotNil(t, statsResp.EventsBySeverity)
		assert.NotNil(t, statsResp.RecentEventTypes)
	})
}

func TestSecurityAuditLogDetailJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "auditdetailuser",
		Email:    "auditdetailuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	listResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "GET",
		Path:   "/api/v1/admin/security-audit-logs?per_page=1",
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 200, listResp.StatusCode)

	var logsResp AuditLogsListResponse
	require.NoError(t, listResp.GetJSON(&logsResp))
	require.NotEmpty(t, logsResp.Logs)
	logID := logsResp.Logs[0].ID

	t.Run("GET /api/v1/admin/security-audit-logs/:id returns log details", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs/" + itoa(logID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var logEntry AuditLogEntry
		require.NoError(t, resp.GetJSON(&logEntry))
		assert.Equal(t, logID, logEntry.ID)
		assert.NotEmpty(t, logEntry.EventType)
		assert.NotEmpty(t, logEntry.EventCategory)
	})

	t.Run("GET /api/v1/admin/security-audit-logs/:id returns 404 for non-existent log", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs/99999",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestMigrationExportJWT(t *testing.T) {
	app := SetupTestApp(t)

	os.Setenv("ENCRYPTION_SECRET", "test-encryption-secret-key-32chars!!")
	t.Cleanup(func() {
		os.Unsetenv("ENCRYPTION_SECRET")
	})

	user := &e2etesting.TestUser{
		Username: "migrationuser",
		Email:    "migrationuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("POST /api/v1/admin/migration/export requires password", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/export",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/export requires minimum password length", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/export",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"password": "short",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/export returns encrypted backup", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/export",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"password": "secure-backup-password-123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestMigrationImportJWT(t *testing.T) {
	app := SetupTestApp(t)

	os.Setenv("ENCRYPTION_SECRET", "test-encryption-secret-key-32chars!!")
	t.Cleanup(func() {
		os.Unsetenv("ENCRYPTION_SECRET")
	})

	user := &e2etesting.TestUser{
		Username: "migrationimportuser",
		Email:    "migrationimportuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("POST /api/v1/admin/migration/import requires password", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/import",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/x-www-form-urlencoded",
			},
			Body: "backup_file=invalid",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/import requires backup_file", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/import",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/x-www-form-urlencoded",
			},
			Body: "password=secure-password-123",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})
}

func TestAdminOperationLogDetailJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "adminoplogdetail",
		Email:    "adminoplogdetail@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/operation-logs/:id returns 404 for non-existent log", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/operation-logs/99999",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestSecurityAuditEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/admin/security-audit-logs requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/security-audit-logs")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/security-audit-logs/stats requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/security-audit-logs/stats")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/security-audit-logs/:id requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/security-audit-logs/1")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/export requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Post("/api/v1/admin/migration/export", map[string]interface{}{
			"password": "secure-password-123",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/import requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/import",
			Headers: map[string]string{
				"Content-Type": "application/x-www-form-urlencoded",
			},
			Body: "password=test",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestSecurityAuditEndpointsNonAdmin(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "nonadminaudit",
		Email:    "nonadminaudit@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/security-audit-logs returns 403 for non-admin", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/security-audit-logs",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/migration/export returns 403 for non-admin", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/migration/export",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"password": "secure-password-123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
