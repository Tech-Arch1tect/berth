package operationlogs

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"berth/internal/domain/server"
	"berth/internal/domain/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var dbCounter atomic.Int64

func newTestService(t *testing.T) *Service {
	t.Helper()
	dsn := fmt.Sprintf("file:oplogs_test_%d?mode=memory&cache=shared", dbCounter.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&user.User{}, &server.Server{}, &OperationLog{}, &OperationLogMessage{}))
	return NewService(db, zap.NewNop())
}

func TestDeleteOldOperationLogs_HardDeletesOldLogsWithMessagesAndKeepsRecent(t *testing.T) {
	s := newTestService(t)
	now := time.Now()

	oldLog := OperationLog{UserID: 1, ServerID: 1, StackName: "s", OperationID: "old", Command: "up", StartTime: now.AddDate(0, 0, -40)}
	recentLog := OperationLog{UserID: 1, ServerID: 1, StackName: "s", OperationID: "recent", Command: "up", StartTime: now.AddDate(0, 0, -5)}
	require.NoError(t, s.db.Create(&oldLog).Error)
	require.NoError(t, s.db.Create(&recentLog).Error)
	require.NoError(t, s.db.Create(&OperationLogMessage{OperationLogID: oldLog.ID, MessageType: "stdout", Timestamp: now.AddDate(0, 0, -40), SequenceNumber: 1}).Error)
	require.NoError(t, s.db.Create(&OperationLogMessage{OperationLogID: recentLog.ID, MessageType: "stdout", Timestamp: now.AddDate(0, 0, -5), SequenceNumber: 1}).Error)

	deleted, err := s.DeleteOldOperationLogs(30)
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted, "only the log older than the retention window is removed")

	assert.Zero(t, unscopedCount(t, s.db, &OperationLog{}, "operation_id = ?", "old"), "old log hard-deleted")
	assert.Zero(t, unscopedCount(t, s.db, &OperationLogMessage{}, "operation_log_id = ?", oldLog.ID), "old log's messages hard-deleted")
	assert.Equal(t, int64(1), unscopedCount(t, s.db, &OperationLog{}, "operation_id = ?", "recent"), "recent log kept")
	assert.Equal(t, int64(1), unscopedCount(t, s.db, &OperationLogMessage{}, "operation_log_id = ?", recentLog.ID), "recent log's messages kept")
}

func unscopedCount(t *testing.T, db *gorm.DB, model any, query string, arg any) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Unscoped().Model(model).Where(query, arg).Count(&n).Error)
	return n
}
