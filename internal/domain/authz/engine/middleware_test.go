package engine

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"berth/internal/domain/authz"
	usermodel "berth/internal/domain/user"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func newMiddlewareCtx(t *testing.T, body io.Reader) echo.Context {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/test", body)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return e.NewContext(req, httptest.NewRecorder())
}

func setJWTPrincipal(c echo.Context, u usermodel.User) {
	authz.SetPrincipal(c, principalForRoles(u.ID, u.Roles))
}

func setAPIKeyPrincipal(c echo.Context, u usermodel.User, key *authz.KeyDescriptor) {
	p := principalForRoles(u.ID, u.Roles)
	authz.SetPrincipal(c, authz.NewPrincipal(p.UserID(), p.IsAdmin(), key))
}

func runMiddleware(t *testing.T, engine *Engine, rule authz.Rule, c echo.Context) (handlerRan bool, err error) {
	t.Helper()
	mw := engine.Middleware(rule)
	err = mw(func(_ echo.Context) error {
		handlerRan = true
		return nil
	})(c)
	return handlerRan, err
}

func httpStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}
	if he, ok := err.(*echo.HTTPError); ok {
		return he.Code
	}
	return http.StatusInternalServerError
}

func TestMiddleware_PublicRule(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	c := newMiddlewareCtx(t, nil)
	ran, err := runMiddleware(t, engine, authz.Public(), c)
	require.NoError(t, err)
	assert.True(t, ran, "handler must run for public rule even with no principal")
}

func TestMiddleware_NoPrincipal_Returns401(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	c := newMiddlewareCtx(t, nil)
	ran, err := runMiddleware(t, engine, authz.Authenticated(), c)
	assert.False(t, ran)
	assert.Equal(t, http.StatusUnauthorized, httpStatus(err))
}

func TestMiddleware_APIKeyDenied_WithAPIKey_Returns403(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)
	key := &authz.KeyDescriptor{Scopes: []authz.KeyScope{scopeForPerm(testPermName, nil)}}

	c := newMiddlewareCtx(t, nil)
	setAPIKeyPrincipal(c, u, key)

	ran, err := runMiddleware(t, engine, authz.APIKeyDenied(), c)
	assert.False(t, ran)
	assert.Equal(t, http.StatusForbidden, httpStatus(err))
}

func TestMiddleware_APIKeyDenied_WithJWT_Passes(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)

	c := newMiddlewareCtx(t, nil)
	setJWTPrincipal(c, u)

	ran, err := runMiddleware(t, engine, authz.APIKeyDenied(), c)
	require.NoError(t, err)
	assert.True(t, ran)
}

func TestMiddleware_StackPerm_WithoutPerm_Returns403(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.noRoleUserID).Error)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	c := e.NewContext(req, httptest.NewRecorder())
	c.SetParamNames("serverid", "stackname")
	c.SetParamValues(fmt.Sprintf("%d", f.serverID), testStackName)
	setJWTPrincipal(c, u)

	ran, err := runMiddleware(t, engine, authz.Stack(testPermName), c)
	assert.False(t, ran)
	assert.Equal(t, http.StatusForbidden, httpStatus(err))
}

func TestMiddleware_StackPerm_WithPerm_Passes(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	c := e.NewContext(req, httptest.NewRecorder())
	c.SetParamNames("serverid", "stackname")
	c.SetParamValues(fmt.Sprintf("%d", f.serverID), testStackName)
	setJWTPrincipal(c, u)

	ran, err := runMiddleware(t, engine, authz.Stack(testPermName), c)
	require.NoError(t, err)
	assert.True(t, ran)
}

func TestMiddleware_APIKeyOutOfScope_Returns403(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)
	key := &authz.KeyDescriptor{Scopes: []authz.KeyScope{scopeForPerm("unrelated.perm", nil)}}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	c := e.NewContext(req, httptest.NewRecorder())
	c.SetParamNames("serverid", "stackname")
	c.SetParamValues(fmt.Sprintf("%d", f.serverID), testStackName)
	setAPIKeyPrincipal(c, u, key)

	ran, err := runMiddleware(t, engine, authz.Stack(testPermName), c)
	assert.False(t, ran)
	assert.Equal(t, http.StatusForbidden, httpStatus(err))
}

func TestMiddleware_ListScoped_PopulatesScopeSet(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)

	c := newMiddlewareCtx(t, nil)
	setJWTPrincipal(c, u)

	var capturedScope authz.ScopeSet
	var scopeOK bool
	mw := engine.Middleware(authz.Authenticated().WithListScope())
	err := mw(func(c echo.Context) error {
		capturedScope, scopeOK = authz.GetScopeSet(c)
		return nil
	})(c)
	require.NoError(t, err)
	assert.True(t, scopeOK, "ScopeSet must be stored in context")
	assert.True(t, capturedScope.AllowsServer(f.serverID))
}

func TestMiddleware_ResolvedRule_BuffersBody(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)

	bodyContent := `{"action":"deploy"}`
	c := newMiddlewareCtx(t, strings.NewReader(bodyContent))
	setJWTPrincipal(c, u)

	resolverRead := ""
	handlerRead := ""

	rule := authz.Resolved(func(c echo.Context) ([]authz.Requirement, error) {
		buf, err := io.ReadAll(c.Request().Body)
		if err != nil {
			return nil, err
		}
		resolverRead = string(buf)
		return []authz.Requirement{{Kind: authz.KindAuthenticated}}, nil
	})

	mw := engine.Middleware(rule)
	err := mw(func(c echo.Context) error {
		buf, err := io.ReadAll(c.Request().Body)
		if err != nil {
			return err
		}
		handlerRead = string(buf)
		return nil
	})(c)
	require.NoError(t, err)
	assert.Equal(t, bodyContent, resolverRead, "resolver must be able to read the body")
	assert.Equal(t, bodyContent, handlerRead, "handler must be able to read the body after resolver")
}

func TestMiddleware_ErrorMessageIsPlainString(t *testing.T) {
	f := seedFixture(t)
	engine := New(f.db, zap.NewNop())

	c := newMiddlewareCtx(t, nil)
	_, err := runMiddleware(t, engine, authz.Authenticated(), c)
	require.Error(t, err)
	he, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	_, isString := he.Message.(string)
	assert.True(t, isString, "HTTPError message must be a plain string, got %T", he.Message)
}

func TestGetScopeSet_AbsentReturnsNotOK(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	c := e.NewContext(req, httptest.NewRecorder())

	_, ok := authz.GetScopeSet(c)
	assert.False(t, ok)
}
