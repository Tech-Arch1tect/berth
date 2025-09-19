package test

import (
	"net/http"
	"time"

	"github.com/tech-arch1tect/brx/services/auth"
)

func (ta *TestApp) GetActiveRememberMeTokens(userID uint) ([]auth.RememberMeToken, error) {
	var tokens []auth.RememberMeToken
	err := ta.db.Where("user_id = ? AND expires_at > ? AND used = false AND deleted_at IS NULL",
		userID, time.Now()).Find(&tokens).Error
	return tokens, err
}

func (ta *TestApp) CreateRememberMeToken(userID uint, token string, expiresAt time.Time) error {
	rememberToken := &auth.RememberMeToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: expiresAt,
		Used:      false,
	}
	return ta.db.Create(rememberToken).Error
}

func (ta *TestApp) GetCookieFromResponse(resp *http.Response, cookieName string) *http.Cookie {
	for _, cookie := range resp.Cookies() {
		if cookie.Name == cookieName {
			return cookie
		}
	}
	return nil
}

func (ta *TestApp) GetRememberMeCookie(resp *http.Response) *http.Cookie {
	return ta.GetCookieFromResponse(resp, "remember_me")
}
