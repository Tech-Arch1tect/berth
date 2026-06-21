package auth

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"berth/internal/pkg/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var cleanupDBCounter atomic.Int64

func newResetCleanupService(t *testing.T, resetEnabled bool) (*Service, *gorm.DB) {
	t.Helper()
	dsn := fmt.Sprintf("file:reset_cleanup_test_%d?mode=memory&cache=shared", cleanupDBCounter.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PasswordResetToken{}))

	cfg := &config.Config{}
	cfg.Auth.PasswordResetEnabled = resetEnabled
	return NewService(cfg, db, nil, nil, zap.NewNop()), db
}

func TestCleanupExpiredTokens_HardDeletesExpiredKeepsValid(t *testing.T) {
	svc, db := newResetCleanupService(t, true)
	now := time.Now()

	require.NoError(t, db.Create(&PasswordResetToken{Email: "a@example.com", Token: "expired", ExpiresAt: now.Add(-time.Hour)}).Error)
	require.NoError(t, db.Create(&PasswordResetToken{Email: "b@example.com", Token: "valid", ExpiresAt: now.Add(time.Hour)}).Error)

	require.NoError(t, svc.CleanupExpiredTokens())

	var expiredCount, validCount int64
	require.NoError(t, db.Unscoped().Model(&PasswordResetToken{}).Where("token = ?", "expired").Count(&expiredCount).Error)
	require.NoError(t, db.Unscoped().Model(&PasswordResetToken{}).Where("token = ?", "valid").Count(&validCount).Error)
	assert.Zero(t, expiredCount, "expired token must be hard-deleted, not soft-deleted")
	assert.Equal(t, int64(1), validCount, "unexpired token must be kept")
}

func TestCleanupExpiredTokens_DisabledIsNoOp(t *testing.T) {
	svc, db := newResetCleanupService(t, false)
	require.NoError(t, db.Create(&PasswordResetToken{Email: "a@example.com", Token: "expired", ExpiresAt: time.Now().Add(-time.Hour)}).Error)

	err := svc.CleanupExpiredTokens()
	require.ErrorIs(t, err, ErrPasswordResetDisabled)

	var count int64
	require.NoError(t, db.Unscoped().Model(&PasswordResetToken{}).Count(&count).Error)
	assert.Equal(t, int64(1), count, "nothing may be deleted while password reset is disabled")
}
