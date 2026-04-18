package harness

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"berth/models"
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

func (h *SessionHelper) GetSessionCookie(resp *Response) *http.Cookie {
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "session" || cookie.Name == "test_session" {
			return cookie
		}
	}
	return nil
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

func (h *SessionHelper) CreateTestSession(t *testing.T, userID uint, token string) {
	sess := models.UserSession{
		UserID:    userID,
		Token:     token,
		Type:      models.SessionTypeWeb,
		IPAddress: "127.0.0.1",
		UserAgent: "Test User Agent",
		ExpiresAt: time.Now().Add(time.Hour),
	}

	err := h.DB.Create(&sess).Error
	require.NoError(t, err, "failed to create test session")
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

func (h *SessionHelper) AssertSessionCookiePresent(t *testing.T, resp *Response) *http.Cookie {
	cookie := h.GetSessionCookie(resp)
	require.NotNil(t, cookie, "session cookie should be present in response")
	require.NotEmpty(t, cookie.Value, "session cookie should have a value")
	return cookie
}

func (h *SessionHelper) WithSessionCookie(cookie *http.Cookie) *HTTPClient {
	client := h.HTTPClient.EnsureCookieJar()

	if cookie != nil && h.HTTPClient.BaseURL != "" {
		u, err := url.Parse(h.HTTPClient.BaseURL)
		if err == nil {
			client.Client.Jar.SetCookies(u, []*http.Cookie{cookie})
		}
	}

	return client.WithoutRedirects()
}

func (h *SessionHelper) SimulateLogin(t *testing.T, authHelper *AuthHelper, username, password string) *HTTPClient {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()

	resp, err := authHelper.LoginWithClient(client, username, password)
	require.NoError(t, err, "login request failed")

	authHelper.AssertLoginSuccess(t, resp)
	h.AssertSessionCookiePresent(t, resp)

	return client
}

func (h *SessionHelper) AssertAuthenticationRequired(t *testing.T, resp *Response) {

	resp.AssertRedirect(t, "/auth/login")
}
