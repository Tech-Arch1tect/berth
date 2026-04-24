package auth

import (
	"net/http"
	"time"

	"berth/internal/domain/auth/totp"
	"berth/internal/domain/session"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type RememberMeConfig struct {
	AuthService  *Service
	UserProvider UserProvider
	TOTPService  *totp.Service
	Logger       *zap.Logger
}

func RememberMeMiddleware(cfg RememberMeConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if session.IsAuthenticated(c) {
				return next(c)
			}
			if cfg.AuthService == nil || !cfg.AuthService.IsRememberMeEnabled() {
				return next(c)
			}

			cookie, err := c.Cookie("remember_me")
			if err != nil || cookie.Value == "" {
				return next(c)
			}

			rememberToken, err := cfg.AuthService.ValidateRememberMeToken(cookie.Value)
			if err != nil {
				cfg.Logger.Debug("remember me token validation failed", zap.Error(err))
				clearRememberCookie(c, cfg.AuthService)
				return next(c)
			}

			if cfg.UserProvider != nil {
				if _, err := cfg.UserProvider.GetUser(rememberToken.UserID); err != nil {
					cfg.Logger.Warn("remember me user not found",
						zap.Uint("user_id", rememberToken.UserID), zap.Error(err))
					clearRememberCookie(c, cfg.AuthService)
					return next(c)
				}
			}

			session.LoginWithTOTPService(c, rememberToken.UserID, cfg.TOTPService)
			if cfg.TOTPService != nil && cfg.TOTPService.IsUserTOTPEnabled(rememberToken.UserID) {
				session.SetTOTPVerified(c, true)
			}

			if cfg.AuthService.ShouldRotateRememberMeToken() {
				if newToken, err := cfg.AuthService.RotateRememberMeToken(cookie.Value); err == nil {
					setRememberCookie(c, cfg.AuthService, newToken.Token, newToken.ExpiresAt)
				} else {
					cfg.Logger.Error("failed to rotate remember me token", zap.Error(err))
				}
			}

			return next(c)
		}
	}
}

func setRememberCookie(c echo.Context, svc *Service, token string, expiresAt time.Time) {
	c.SetCookie(&http.Cookie{
		Name:     "remember_me",
		Value:    token,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   svc.GetRememberMeCookieSecure(),
		SameSite: rememberMeSameSite(svc.GetRememberMeCookieSameSite()),
		Path:     "/",
	})
}

func clearRememberCookie(c echo.Context, svc *Service) {
	c.SetCookie(&http.Cookie{
		Name:     "remember_me",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   svc.GetRememberMeCookieSecure(),
		SameSite: rememberMeSameSite(svc.GetRememberMeCookieSameSite()),
		Path:     "/",
	})
}

func rememberMeSameSite(setting string) http.SameSite {
	switch setting {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
