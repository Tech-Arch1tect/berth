package authz

import (
	"bytes"
	"errors"
	"io"
	"net/http"

	"berth/internal/domain/auth"
	usermodel "berth/internal/domain/user"

	"github.com/labstack/echo/v4"
)

const ScopeSetKey = "_authz_scope_set"

func Middleware(engine *Engine, rule Rule) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if rule.public {
				return next(c)
			}
			p, err := principalFromContext(c)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
			}
			if rule.denyAPIKey && p.APIKey != nil {
				return echo.NewHTTPError(http.StatusForbidden, "API keys cannot access this endpoint")
			}
			bodyBuf, err := readBody(c)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
			}
			resetBody(c, bodyBuf)
			reqs, err := rule.resolve(c)
			if err != nil {
				return err
			}
			resetBody(c, bodyBuf)
			ok, err := engine.Authorize(p, reqs...)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Authorisation check failed")
			}
			if !ok {
				return echo.NewHTTPError(http.StatusForbidden, "Insufficient permissions")
			}
			if rule.listScope {
				scope, err := engine.AuthorizedScope(p)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Authorisation check failed")
				}
				c.Set(ScopeSetKey, scope)
			}
			resetBody(c, bodyBuf)
			return next(c)
		}
	}
}

func principalFromContext(c echo.Context) (Principal, error) {
	userID := auth.GetUserID(c)
	if userID == 0 {
		return Principal{}, errors.New("no authenticated user")
	}
	currentUser := auth.GetCurrentUser(c)
	u, ok := currentUser.(usermodel.User)
	if !ok {
		return Principal{}, errors.New("current user not a usermodel.User")
	}
	return Principal{
		UserID: userID,
		Roles:  u.Roles,
		APIKey: auth.GetAPIKey(c),
	}, nil
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

func GetScopeSet(c echo.Context) (ScopeSet, bool) {
	v := c.Get(ScopeSetKey)
	if v == nil {
		return ScopeSet{}, false
	}
	s, ok := v.(ScopeSet)
	return s, ok
}
