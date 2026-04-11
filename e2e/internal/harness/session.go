package harness

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/session"
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

func (h *SessionHelper) GetSessions() (*Response, error) {
	return h.HTTPClient.Get("/sessions")
}

func (h *SessionHelper) RevokeSession(token string) (*Response, error) {
	formData := url.Values{
		"token": {token},
	}

	return h.HTTPClient.PostForm("/sessions/revoke", formData)
}

func (h *SessionHelper) RevokeAllOtherSessions() (*Response, error) {
	return h.HTTPClient.PostForm("/sessions/revoke-all-others", url.Values{})
}

func (h *SessionHelper) GetSessionCookie(resp *Response) *http.Cookie {
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "session" || cookie.Name == "test_session" {
			return cookie
		}
	}
	return nil
}

func (h *SessionHelper) ExtractSessionToken(cookie *http.Cookie) string {
	if cookie == nil {
		return ""
	}
	return cookie.Value
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

func (h *SessionHelper) GetUserSessions(t *testing.T, userID uint) []session.UserSession {
	var sessions []session.UserSession
	err := h.DB.Where("user_id = ?", userID).Find(&sessions).Error
	require.NoError(t, err, "failed to retrieve user sessions")
	return sessions
}

func (h *SessionHelper) GetSessionByToken(t *testing.T, token string) *session.UserSession {
	var sess session.UserSession
	err := h.DB.Where("token = ?", token).First(&sess).Error
	require.NoError(t, err, "failed to find session by token")
	return &sess
}

func (h *SessionHelper) CreateTestSession(t *testing.T, userID uint, token string) {
	sess := session.UserSession{
		UserID:    userID,
		Token:     token,
		Type:      session.SessionTypeWeb,
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

func (h *SessionHelper) AssertSessionCookieAbsent(t *testing.T, resp *Response) {
	cookie := h.GetSessionCookie(resp)

	if cookie != nil {
		expired := cookie.MaxAge <= 0
		if !expired && !cookie.Expires.IsZero() {
			expired = cookie.Expires.Before(time.Now())
		}
		require.Truef(t, expired, "session cookie should be expired or have non-positive MaxAge (maxAge=%d expires=%v value=%s)", cookie.MaxAge, cookie.Expires, cookie.Value)
	}
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

	resp, err := authHelper.Login(username, password)
	require.NoError(t, err, "login request failed")

	authHelper.AssertLoginSuccess(t, resp)

	sessionCookie := h.AssertSessionCookiePresent(t, resp)

	return h.WithSessionCookie(sessionCookie)
}

func (h *SessionHelper) AssertAuthenticationRequired(t *testing.T, resp *Response) {

	resp.AssertRedirect(t, "/auth/login")
}

func (h *SessionHelper) AssertTOTPRequired(t *testing.T, resp *Response) {

	resp.AssertRedirect(t, "/auth/totp/verify")
}
