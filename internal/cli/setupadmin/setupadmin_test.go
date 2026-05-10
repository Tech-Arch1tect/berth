package setupadmin

import (
	"bytes"
	"strings"
	"testing"

	"berth/internal/app"
	"berth/internal/app/apptest"
	"berth/internal/domain/auth"
	"berth/internal/domain/rbac"
	"berth/internal/domain/setup"
	"berth/internal/domain/user"
	"berth/internal/pkg/config"
	"berth/seeds"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func buildTestEnv(t *testing.T) (*config.Config, *gorm.DB, *zap.Logger) {
	t.Helper()
	cfg := apptest.BuildConfig(t)
	logger := zap.NewNop()
	db, err := app.OpenDatabase(cfg, logger, app.DatabaseModels()...)
	require.NoError(t, err)
	require.NoError(t, seeds.SeedRBACData(db), "RBAC seed mirrors the seeding Run does after OpenDatabase")
	return cfg, db, logger
}

func TestRun_NoArgsListsEveryMissingFlag(t *testing.T) {
	t.Parallel()

	var stdout, stderr bytes.Buffer
	code := Run(nil, &stdout, &stderr)

	assert.Equal(t, 2, code, "missing every required flag should exit 2")
	assert.Empty(t, stdout.String(), "no admin-created line should be emitted on usage error")
	got := stderr.String()
	assert.Contains(t, got, "missing required flag(s)")
	assert.Contains(t, got, "--username")
	assert.Contains(t, got, "--email")
	assert.Contains(t, got, "--password")
}

func TestRun_NamesOnlyTheMissingFlag(t *testing.T) {
	t.Parallel()

	var stdout, stderr bytes.Buffer
	code := Run([]string{"--username", "alice", "--email", "alice@example.com"}, &stdout, &stderr)

	assert.Equal(t, 2, code)
	got := stderr.String()
	assert.Contains(t, got, "--password", "the missing flag should be named")
	assert.NotContains(t, got, "--username", "supplied flags should not appear in the missing list")
	assert.NotContains(t, got, "--email")
}

func TestRun_RejectsWhitespaceOnlyValues(t *testing.T) {
	t.Parallel()

	var stdout, stderr bytes.Buffer
	code := Run([]string{"--username", "   ", "--email", "alice@example.com", "--password", "Pass1234!"}, &stdout, &stderr)

	assert.Equal(t, 2, code, "whitespace-only required value should be treated as missing")
	assert.Contains(t, stderr.String(), "--username")
}

func TestRun_UnknownFlagReturnsUsageExit(t *testing.T) {
	t.Parallel()

	var stdout, stderr bytes.Buffer
	code := Run([]string{"--unknown", "value"}, &stdout, &stderr)

	assert.Equal(t, 2, code, "unknown flag should propagate as a usage error")
}

func TestDoSetup_CreatesAdminWithHashedPassword(t *testing.T) {
	t.Parallel()
	cfg, db, logger := buildTestEnv(t)

	var stdout, stderr bytes.Buffer
	const plaintext = "Pass1234!"
	code := doSetup("alice", "alice@example.com", plaintext, &stdout, &stderr, cfg, db, logger)

	require.Equal(t, 0, code, "stdout=%q stderr=%q", stdout.String(), stderr.String())
	assert.Contains(t, stdout.String(), "admin user created")
	assert.Contains(t, stdout.String(), "alice")

	rbacSvc := rbac.NewService(db, logger)
	authSvc := auth.NewService(cfg, db, nil, nil, logger)
	setupSvc := setup.NewService(db, rbacSvc, logger)

	exists, err := setupSvc.AdminExists()
	require.NoError(t, err)
	assert.True(t, exists, "AdminExists should report true after CLI run — proves admin role was assigned")

	var u user.User
	require.NoError(t, db.Where("username = ?", "alice").First(&u).Error)
	assert.NotEqual(t, plaintext, u.Password, "password must not be stored plaintext")
	assert.NoError(t, authSvc.VerifyPassword(u.Password, plaintext), "stored hash must verify against the input")
}

func TestDoSetup_RefusesWhenAdminExists(t *testing.T) {
	t.Parallel()
	cfg, db, logger := buildTestEnv(t)

	rbacSvc := rbac.NewService(db, logger)
	authSvc := auth.NewService(cfg, db, nil, nil, logger)
	setupSvc := setup.NewService(db, rbacSvc, logger)
	hashed, err := authSvc.HashPassword("Existing1!")
	require.NoError(t, err)
	_, err = setupSvc.CreateAdmin("existing", "existing@example.com", hashed)
	require.NoError(t, err)

	var beforeCount int64
	require.NoError(t, db.Model(&user.User{}).Count(&beforeCount).Error)

	var stdout, stderr bytes.Buffer
	code := doSetup("alice", "alice@example.com", "Pass1234!", &stdout, &stderr, cfg, db, logger)

	assert.Equal(t, 1, code, "second run must refuse when an admin already exists")
	assert.Contains(t, strings.ToLower(stderr.String()), "already exists")

	var afterCount int64
	require.NoError(t, db.Model(&user.User{}).Count(&afterCount).Error)
	assert.Equal(t, beforeCount, afterCount, "no additional user row should be created")
}

func TestDoSetup_WeakPasswordRejected(t *testing.T) {
	t.Parallel()
	cfg, db, logger := buildTestEnv(t)

	var stdout, stderr bytes.Buffer
	code := doSetup("alice", "alice@example.com", "short", &stdout, &stderr, cfg, db, logger)

	assert.Equal(t, 1, code)
	assert.Contains(t, strings.ToLower(stderr.String()), "at least", "password policy error should reach the user")

	var count int64
	require.NoError(t, db.Model(&user.User{}).Count(&count).Error)
	assert.Equal(t, int64(0), count, "no user row should be created when validation fails")
}
