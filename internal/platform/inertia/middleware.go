package inertia

import (
	"strings"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
)

type UserLookup func(userID uint) (any, error)

func isStaticAssetPath(p string) bool {
	return strings.HasPrefix(p, "/build/") ||
		strings.HasPrefix(p, "/assets/") ||
		strings.HasPrefix(p, "/.well-known/")
}

func SharedContext(
	lookupUser UserLookup,
	isAuth IsAuthenticatedFunc,
	getUserID UserIDFunc,
	getFlash FlashMessagesFunc,
) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if isStaticAssetPath(c.Request().URL.Path) {
				return next(c)
			}

			ctx := c.Request().Context()

			authenticated := isAuth != nil && isAuth(c)
			ctx = gonertia.SetProp(ctx, "authenticated", authenticated)
			if authenticated && getUserID != nil {
				userID := getUserID(c)
				if userID > 0 {
					ctx = gonertia.SetProp(ctx, "userID", userID)
					if lookupUser != nil {
						if user, err := lookupUser(userID); err == nil && user != nil {
							ctx = gonertia.SetProp(ctx, "currentUser", user)
						}
					}
				}
			}

			if getFlash != nil {
				if flash := getFlash(c); flash != nil {
					ctx = gonertia.SetProp(ctx, "flashMessages", flash)
				}
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
