package auth

import (
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/csrf"
	"github.com/tech-arch1tect/brx/session"
)

func ConditionalCSRFMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	csrfMiddleware := csrf.WithConfig(&cfg.CSRF)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {

			authHeader := c.Request().Header.Get("Authorization")

			if authHeader != "" {
				// JWT or API Key authentication - skip CSRF validation
				return next(c)
			}

			if session.IsAuthenticated(c) {
				return csrfMiddleware(next)(c)
			}

			return next(c)
		}
	}
}
