package security

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var dbCounter atomic.Int64

func newAuditTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:audit_test_%d?mode=memory&cache=shared", dbCounter.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&SecurityAuditLog{}))
	return db
}

func TestDeleteOldLogs_HardDeletesRowsPastRetention(t *testing.T) {
	db := newAuditTestDB(t)
	svc := NewAuditService(db, zap.NewNop())
	now := time.Now()

	old := SecurityAuditLog{EventType: "old", EventCategory: "registry", Severity: "medium"}
	old.CreatedAt = now.AddDate(0, 0, -400)
	recent := SecurityAuditLog{EventType: "recent", EventCategory: "registry", Severity: "medium"}
	recent.CreatedAt = now.AddDate(0, 0, -10)
	require.NoError(t, db.Create(&old).Error)
	require.NoError(t, db.Create(&recent).Error)

	deleted, err := svc.DeleteOldLogs(365)
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	var oldCount, recentCount int64
	require.NoError(t, db.Unscoped().Model(&SecurityAuditLog{}).Where("event_type = ?", "old").Count(&oldCount).Error)
	require.NoError(t, db.Unscoped().Model(&SecurityAuditLog{}).Where("event_type = ?", "recent").Count(&recentCount).Error)
	assert.Zero(t, oldCount, "audit row past retention must be hard-deleted, not soft-deleted")
	assert.Equal(t, int64(1), recentCount, "audit row within retention must be kept")
}
