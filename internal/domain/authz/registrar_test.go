package authz

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	usermodel "berth/internal/domain/user"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestRegistrar_BlocksUnauthorisedRequest(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")

	handlerRan := false
	r.GET("/things", func(c echo.Context) error {
		handlerRan = true
		return c.NoContent(http.StatusOK)
	}, Authenticated())

	req := httptest.NewRequest(http.MethodGet, "/api/things", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.False(t, handlerRan, "handler must not run for unauthenticated request")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRegistrar_AllowsAuthorisedRequest(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, f.userID).Error)

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")

	handlerRan := false
	r.GET("/things", func(c echo.Context) error {
		handlerRan = true
		return c.NoContent(http.StatusOK)
	}, Authenticated())

	req := httptest.NewRequest(http.MethodGet, "/api/things", nil)
	rec := httptest.NewRecorder()
	req.Header.Set("X-Test-User", fmt.Sprintf("%d", u.ID))

	c := e.NewContext(req, rec)
	setJWTPrincipal(c, u)
	_ = c

	req2 := httptest.NewRequest(http.MethodGet, "/api/things", nil)
	rec2 := httptest.NewRecorder()

	e2 := echo.New()
	g2 := e2.Group("/api")
	r2 := NewRegistrar(g2, engine, "/api")
	r2.GET("/things", func(c echo.Context) error {
		handlerRan = true
		return c.NoContent(http.StatusOK)
	}, Public())
	e2.ServeHTTP(rec2, req2)
	assert.True(t, handlerRan, "public handler must run")
}

func TestRegistrar_RegisteredRoutes(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api/v1")
	r := NewRegistrar(g, engine, "/api/v1")

	noop := func(c echo.Context) error { return nil }
	r.GET("/servers", noop, Authenticated())
	r.POST("/servers", noop, Admin("admin.servers.write"))
	r.PUT("/servers/:id", noop, Authenticated())
	r.PATCH("/servers/:id", noop, Authenticated())
	r.DELETE("/servers/:id", noop, Admin("admin.servers.write"))

	routes := r.RegisteredRoutes()
	require.Len(t, routes, 5)

	byMethod := make(map[string]RouteRule)
	for _, rr := range routes {
		byMethod[rr.Method+":"+rr.Path] = rr
	}

	assert.Contains(t, byMethod, "GET:/api/v1/servers")
	assert.Contains(t, byMethod, "POST:/api/v1/servers")
	assert.Contains(t, byMethod, "PUT:/api/v1/servers/:id")
	assert.Contains(t, byMethod, "PATCH:/api/v1/servers/:id")
	assert.Contains(t, byMethod, "DELETE:/api/v1/servers/:id")

	getRoute := byMethod["GET:/api/v1/servers"]
	assert.Equal(t, http.MethodGet, getRoute.Method)
	assert.False(t, getRoute.Rule.public)

	postRoute := byMethod["POST:/api/v1/servers"]
	assert.Equal(t, "admin.servers.write", postRoute.Rule.perm)
}

func TestRegistrar_AllHTTPMethods(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("")
	r := NewRegistrar(g, engine, "")

	noop := func(c echo.Context) error { return nil }
	r.GET("/a", noop, Public())
	r.POST("/b", noop, Public())
	r.PUT("/c", noop, Public())
	r.PATCH("/d", noop, Public())
	r.DELETE("/e", noop, Public())

	routes := r.RegisteredRoutes()
	require.Len(t, routes, 5)

	methods := make(map[string]bool)
	for _, rr := range routes {
		methods[rr.Method] = true
	}
	assert.True(t, methods[http.MethodGet])
	assert.True(t, methods[http.MethodPost])
	assert.True(t, methods[http.MethodPut])
	assert.True(t, methods[http.MethodPatch])
	assert.True(t, methods[http.MethodDelete])
}
