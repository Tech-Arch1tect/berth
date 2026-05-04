package app_test

import (
	"io"
	"net/http"
	"testing"
	"time"

	"berth/internal/app/apptest"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/server"
	"berth/internal/domain/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBoot_HTTPSListenerServes(t *testing.T) {
	t.Parallel()
	booted := apptest.Boot(t)

	baseURL := apptest.WaitForListener(t, booted.Echo, 5*time.Second)

	resp, err := apptest.NewTLSClient().Get(baseURL + "/")
	require.NoError(t, err, "HTTPS request should succeed against the boot listener")
	defer resp.Body.Close()

	require.NotZero(t, resp.StatusCode, "response must carry a status code")
}

func TestBoot_RBACDataSeeded(t *testing.T) {
	t.Parallel()
	booted := apptest.Boot(t)

	var roleCount int64
	require.NoError(t, booted.DB.Raw(
		"SELECT COUNT(*) FROM roles WHERE name = ?", "admin",
	).Scan(&roleCount).Error)
	assert.Equal(t, int64(1), roleCount, "admin role should be seeded by SeedRBACData")

	var permCount int64
	require.NoError(t, booted.DB.Raw(
		"SELECT COUNT(*) FROM permissions",
	).Scan(&permCount).Error)
	assert.Greater(t, permCount, int64(0), "permissions should be seeded by SeedRBACData")
}

func TestBoot_InertiaPageRenders(t *testing.T) {
	t.Parallel()
	booted := apptest.Boot(t)

	baseURL := apptest.WaitForListener(t, booted.Echo, 5*time.Second)

	resp, err := apptest.NewTLSClient().Get(baseURL + "/setup/admin")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	require.Equalf(t, http.StatusOK, resp.StatusCode,
		"setup page must render (body: %s)", truncateForLog(string(body)))

	bodyStr := string(body)
	assert.Contains(t, bodyStr, `id="app"`,
		"rendered HTML must contain inertia mount node — proves inertia init hook + middleware ran")
	assert.Contains(t, bodyStr, "Setup",
		"rendered HTML should reference the setup page name")
}

func TestBoot_AuditCallbacksFireOnInsert(t *testing.T) {
	t.Parallel()
	spy := newSpyOperationAuditor()

	booted := apptest.Boot(t, apptest.WithOperationAuditor(spy))

	usr := user.User{Username: "auditor-test", Email: "auditor@example.com", Password: "x"}
	require.NoError(t, booted.DB.Create(&usr).Error)
	srv := server.Server{Name: "auditor-test", Host: "localhost", Port: 1, AccessToken: "x"}
	require.NoError(t, booted.DB.Create(&srv).Error)

	require.NoError(t, booted.DB.Create(&operationlogs.OperationLog{
		UserID:      usr.ID,
		ServerID:    srv.ID,
		StackName:   "stack-x",
		OperationID: "op-1",
		Command:     "up",
		Status:      operationlogs.OperationStatusCompleted,
		StartTime:   time.Now(),
	}).Error)

	select {
	case got := <-spy.creates:
		assert.Equal(t, "op-1", got.OperationID,
			"the gorm callback registered by RegisterAuditCallbacks must forward the create to the auditor")
	case <-time.After(2 * time.Second):
		t.Fatal("operation auditor never received the create — RegisterAuditCallbacks invoke likely missing")
	}
}

type spyOperationAuditor struct {
	creates chan *operationlogs.OperationLog
}

func newSpyOperationAuditor() *spyOperationAuditor {
	return &spyOperationAuditor{
		creates: make(chan *operationlogs.OperationLog, 4),
	}
}

func (s *spyOperationAuditor) LogOperationCreate(log *operationlogs.OperationLog) {
	s.creates <- log
}

func (s *spyOperationAuditor) LogOperationUpdate(*operationlogs.OperationLog) {}

func truncateForLog(s string) string {
	const max = 200
	if len(s) <= max {
		return s
	}
	return s[:max] + "…(truncated)"
}
