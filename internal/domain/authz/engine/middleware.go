package engine

import (
	"bytes"
	"io"
	"net/http"

	"berth/internal/domain/authz"

	"github.com/labstack/echo/v4"
)

func (e *Engine) Middleware(rule authz.Rule) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if rule.IsPublic() {
				return next(c)
			}
			p, ok := authz.PrincipalFromEcho(c)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
			}
			if rule.DeniesAPIKey() && p.Key() != nil {
				return echo.NewHTTPError(http.StatusForbidden, "API keys cannot access this endpoint")
			}
			bodyBuf, err := readBody(c)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
			}
			resetBody(c, bodyBuf)
			reqs, err := rule.Resolve(c)
			if err != nil {
				return err
			}
			resetBody(c, bodyBuf)
			allowed, err := e.Authorize(p, reqs...)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Authorisation check failed")
			}
			if !allowed {
				return echo.NewHTTPError(http.StatusForbidden, "Insufficient permissions")
			}
			if rule.WantsListScope() {
				scope, err := e.AuthorizedScope(p)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Authorisation check failed")
				}
				c.Set(authz.ScopeSetKey, scope)
			}
			resetBody(c, bodyBuf)
			return next(c)
		}
	}
}

func readBody(c echo.Context) ([]byte, error) {
	req := c.Request()
	if req.Body == nil || req.Body == http.NoBody {
		return nil, nil
	}
	buf, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	_ = req.Body.Close()
	return buf, nil
}

func resetBody(c echo.Context, buf []byte) {
	if buf == nil {
		return
	}
	req := c.Request()
	req.Body = io.NopCloser(bytes.NewReader(buf))
	c.SetRequest(req)
}
