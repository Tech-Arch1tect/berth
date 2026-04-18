package inertia

import (
	"strings"

	"berth/internal/session"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
)

type UserLookup func(userID uint) (any, error)

func isStaticAssetPath(p string) bool {
	return strings.HasPrefix(p, "/build/") ||
		strings.HasPrefix(p, "/assets/") ||
		strings.HasPrefix(p, "/.well-known/")
}

func SharedContext(lookupUser UserLookup) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if isStaticAssetPath(c.Request().URL.Path) {
				return next(c)
			}

			ctx := c.Request().Context()

			isAuth := session.IsAuthenticated(c)
			userID := session.GetUserIDAsUint(c)
			ctx = gonertia.SetProp(ctx, "authenticated", isAuth)
			if isAuth && userID > 0 {
				ctx = gonertia.SetProp(ctx, "userID", userID)
				if lookupUser != nil {
					if user, err := lookupUser(userID); err == nil && user != nil {
						ctx = gonertia.SetProp(ctx, "currentUser", user)
					}
				}
			}

			if flash := session.GetFlashMessages(c); flash != nil {
				ctx = gonertia.SetProp(ctx, "flashMessages", flash)
			}

			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}

func CSRFContext(contextKey string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if isStaticAssetPath(c.Request().URL.Path) {
				return next(c)
			}
			if token := c.Get(contextKey); token != nil {
				if s, ok := token.(string); ok {
					ctx := gonertia.SetProp(c.Request().Context(), "csrfToken", s)
					c.SetRequest(c.Request().WithContext(ctx))
				}
			}
			return next(c)
		}
	}
}
