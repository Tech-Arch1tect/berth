package auth

import (
	"net/http"

	"berth/internal/pkg/config"
	"berth/internal/session"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func CSRFMiddleware(cfg *config.CSRFConfig) echo.MiddlewareFunc {
	if !cfg.Enabled {
		return func(next echo.HandlerFunc) echo.HandlerFunc {
			return next
		}
	}

	var sameSite http.SameSite
	switch cfg.CookieSameSite {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "lax":
		sameSite = http.SameSiteLaxMode
	case "none":
		sameSite = http.SameSiteNoneMode
	default:
		sameSite = http.SameSiteDefaultMode
	}

	return middleware.CSRFWithConfig(middleware.CSRFConfig{
		TokenLength:    cfg.TokenLength,
		TokenLookup:    cfg.TokenLookup,
		ContextKey:     cfg.ContextKey,
		CookieName:     cfg.CookieName,
		CookieDomain:   cfg.CookieDomain,
		CookiePath:     cfg.CookiePath,
		CookieMaxAge:   cfg.CookieMaxAge,
		CookieSecure:   cfg.CookieSecure,
		CookieHTTPOnly: cfg.CookieHTTPOnly,
		CookieSameSite: sameSite,
	})
}

func ConditionalCSRFMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	csrfMiddleware := CSRFMiddleware(&cfg.CSRF)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if session.IsAuthenticated(c) {
				return csrfMiddleware(next)(c)
			}
			return next(c)
		}
	}
}
