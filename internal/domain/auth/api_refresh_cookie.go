package auth

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	refreshCookieName = "berth_refresh"
	refreshCookiePath = "/api/v1/auth"
)

func setRefreshCookie(c echo.Context, token string, expiresAt time.Time) {
	c.SetCookie(&http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     refreshCookiePath,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
}
