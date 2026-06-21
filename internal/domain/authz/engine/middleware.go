package engine

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"berth/internal/domain/authz"

	"github.com/labstack/echo/v4"
)

type AuthorizationAuditor interface {
	LogAuthorizationDenied(actorUserID *uint, actorUsername, ip, resource, permission string, metadata map[string]any) error
}

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
				e.auditDenied(c, p, "api key forbidden on this endpoint")
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
				e.auditDenied(c, p, permissionsString(reqs))
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

func (e *Engine) auditDenied(c echo.Context, p authz.Principal, permission string) {
	if e.auditor == nil {
		return
	}

	var actor *uint
	if id := p.UserID(); id != 0 {
		actor = &id
	}
	resource := c.Request().Method + " " + c.Path()
	ip := c.RealIP()

	go func() {
		_ = e.auditor.LogAuthorizationDenied(actor, "", ip, resource, permission, nil)
	}()
}

func permissionsString(reqs []authz.Requirement) string {
	perms := make([]string, 0, len(reqs))
	for _, r := range reqs {
		if r.Permission != "" {
			perms = append(perms, r.Permission)
		}
	}
	return strings.Join(perms, ",")
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
