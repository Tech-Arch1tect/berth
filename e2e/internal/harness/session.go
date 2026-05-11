package harness

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type SessionHelper struct {
	HTTPClient *HTTPClient
	DB         *gorm.DB
}

func NewSessionHelper(httpClient *HTTPClient, db *gorm.DB) *SessionHelper {
	return &SessionHelper{
		HTTPClient: httpClient,
		DB:         db,
	}
}

func (h *SessionHelper) AssertSessionExists(t *testing.T, userID uint) {
	deadline := time.Now().Add(200 * time.Millisecond)
	for {
		var count int64
		err := h.DB.Table("user_sessions").Where("user_id = ?", userID).Count(&count).Error
		require.NoError(t, err, "failed to check session existence")
		if count > 0 {
			return
		}
		if time.Now().After(deadline) {
			require.Greater(t, count, int64(0), "session should exist for user")
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func (h *SessionHelper) AssertSessionNotExists(t *testing.T, userID uint) {
	var count int64
	err := h.DB.Table("user_sessions").Where("user_id = ?", userID).Count(&count).Error
	require.NoError(t, err, "failed to check session existence")
	require.Equal(t, int64(0), count, "no session should exist for user")
}

func (h *SessionHelper) AssertSessionCount(t *testing.T, userID uint, expectedCount int) {
	var count int64
	err := h.DB.Table("user_sessions").Where("user_id = ?", userID).Count(&count).Error
	require.NoError(t, err, "failed to count sessions")
	require.Equal(t, int64(expectedCount), count, "unexpected number of sessions")
}

func (h *SessionHelper) CleanSessionTables() error {
	tables := []string{
		"user_sessions",
	}

	for _, table := range tables {
		if err := h.DB.Exec("DELETE FROM " + table).Error; err != nil {
			return fmt.Errorf("failed to clean table %s: %w", table, err)
		}
	}

	return nil
}

func (h *SessionHelper) SimulateLogin(t *testing.T, authHelper *AuthHelper, username, password string) *HTTPClient {
	t.Helper()
	token := authHelper.JWTLogin(t, username, password)
	return h.HTTPClient.WithBearerToken(token)
}
