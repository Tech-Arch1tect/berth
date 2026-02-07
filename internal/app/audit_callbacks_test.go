package app

import (
	"sync"
	"testing"
	"time"

	"berth/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type spyOperationAuditor struct {
	mu      sync.Mutex
	creates []*models.OperationLog
	updates []*models.OperationLog
}

func (s *spyOperationAuditor) LogOperationCreate(log *models.OperationLog) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.creates = append(s.creates, log)
}

func (s *spyOperationAuditor) LogOperationUpdate(log *models.OperationLog) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.updates = append(s.updates, log)
}

func (s *spyOperationAuditor) getCreates() []*models.OperationLog {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]*models.OperationLog{}, s.creates...)
}

func (s *spyOperationAuditor) getUpdates() []*models.OperationLog {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]*models.OperationLog{}, s.updates...)
}

type spySecurityAuditor struct {
	mu     sync.Mutex
	events []*models.SecurityAuditLog
}

func (s *spySecurityAuditor) LogSecurityEvent(log *models.SecurityAuditLog) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append(s.events, log)
}

func (s *spySecurityAuditor) getEvents() []*models.SecurityAuditLog {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]*models.SecurityAuditLog{}, s.events...)
}

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	err = db.AutoMigrate(&models.OperationLog{}, &models.SecurityAuditLog{})
	require.NoError(t, err)

	return db
}

func TestRegisterAuditCallbacks_OperationLogCreate(t *testing.T) {
	db := setupTestDB(t)
	spy := &spyOperationAuditor{}

	RegisterAuditCallbacks(AuditCallbackParams{
		DB:                   db,
		OperationAuditLogger: spy,
	})

	log := &models.OperationLog{
		UserID:      1,
		ServerID:    1,
		StackName:   "test-stack",
		OperationID: "op-123",
		Command:     "up",
		StartTime:   time.Now(),
	}
	err := db.Create(log).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(spy.getCreates()) == 1
	}, time.Second, 10*time.Millisecond, "expected LogOperationCreate to be called")

	created := spy.getCreates()[0]
	assert.Equal(t, "test-stack", created.StackName)
	assert.Equal(t, "op-123", created.OperationID)
	assert.Equal(t, "up", created.Command)
}

func TestRegisterAuditCallbacks_OperationLogUpdate(t *testing.T) {
	db := setupTestDB(t)
	spy := &spyOperationAuditor{}

	RegisterAuditCallbacks(AuditCallbackParams{
		DB:                   db,
		OperationAuditLogger: spy,
	})

	log := &models.OperationLog{
		UserID:      1,
		ServerID:    1,
		StackName:   "test-stack",
		OperationID: "op-456",
		Command:     "down",
		StartTime:   time.Now(),
	}
	err := db.Create(log).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(spy.getCreates()) == 1
	}, time.Second, 10*time.Millisecond)

	success := true
	log.Success = &success
	err = db.Save(log).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(spy.getUpdates()) == 1
	}, time.Second, 10*time.Millisecond, "expected LogOperationUpdate to be called")

	updated := spy.getUpdates()[0]
	assert.Equal(t, "op-456", updated.OperationID)
	assert.NotNil(t, updated.Success)
	assert.True(t, *updated.Success)
}

func TestRegisterAuditCallbacks_SecurityAuditLogCreate(t *testing.T) {
	db := setupTestDB(t)
	spy := &spySecurityAuditor{}

	RegisterAuditCallbacks(AuditCallbackParams{
		DB:                  db,
		SecurityAuditLogger: spy,
	})

	log := &models.SecurityAuditLog{
		EventType:     "auth.login",
		EventCategory: models.CategoryAuth,
		Severity:      models.SeverityLow,
		Success:       true,
		ActorUsername: "testuser",
	}
	err := db.Create(log).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(spy.getEvents()) == 1
	}, time.Second, 10*time.Millisecond, "expected LogSecurityEvent to be called")

	event := spy.getEvents()[0]
	assert.Equal(t, "auth.login", event.EventType)
	assert.Equal(t, models.CategoryAuth, event.EventCategory)
	assert.Equal(t, "testuser", event.ActorUsername)
}

func TestRegisterAuditCallbacks_NilLoggersNoError(t *testing.T) {
	db := setupTestDB(t)

	RegisterAuditCallbacks(AuditCallbackParams{
		DB: db,
	})

	log := &models.OperationLog{
		UserID:      1,
		ServerID:    1,
		StackName:   "test-stack",
		OperationID: "op-789",
		Command:     "up",
		StartTime:   time.Now(),
	}
	err := db.Create(log).Error
	require.NoError(t, err)
}

func TestRegisterAuditCallbacks_DoesNotFireForOtherTables(t *testing.T) {
	db := setupTestDB(t)
	opSpy := &spyOperationAuditor{}
	secSpy := &spySecurityAuditor{}

	RegisterAuditCallbacks(AuditCallbackParams{
		DB:                   db,
		OperationAuditLogger: opSpy,
		SecurityAuditLogger:  secSpy,
	})

	secLog := &models.SecurityAuditLog{
		EventType:     "auth.login",
		EventCategory: models.CategoryAuth,
		Severity:      models.SeverityLow,
		Success:       true,
	}
	err := db.Create(secLog).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(secSpy.getEvents()) == 1
	}, time.Second, 10*time.Millisecond)

	assert.Empty(t, opSpy.getCreates(), "operation create callback should not fire for security audit log")
	assert.Empty(t, opSpy.getUpdates(), "operation update callback should not fire for security audit log")

	opLog := &models.OperationLog{
		UserID:      1,
		ServerID:    1,
		StackName:   "test-stack",
		OperationID: "op-cross",
		Command:     "up",
		StartTime:   time.Now(),
	}
	err = db.Create(opLog).Error
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(opSpy.getCreates()) == 1
	}, time.Second, 10*time.Millisecond)

	assert.Equal(t, 1, len(secSpy.getEvents()), "security callback should not fire for operation log")
}
