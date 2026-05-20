package authz

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistrar_RegisteredRoutes(t *testing.T) {
	e := echo.New()
	g := e.Group("/api/v1")
	r := NewRegistrar(g, "/api/v1", passthroughMW)

	noopH := func(c echo.Context) error { return nil }
	r.GET("/servers", noopH, Authenticated())
	r.POST("/servers", noopH, Admin("admin.servers.write"))
	r.PUT("/servers/:id", noopH, Authenticated())
	r.PATCH("/servers/:id", noopH, Authenticated())
	r.DELETE("/servers/:id", noopH, Admin("admin.servers.write"))

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
	assert.False(t, getRoute.Rule.IsPublic())

	postRoute := byMethod["POST:/api/v1/servers"]
	assert.Equal(t, "admin.servers.write", postRoute.Rule.perm)
}

func TestRegistrar_AllHTTPMethods(t *testing.T) {
	e := echo.New()
	g := e.Group("")
	r := NewRegistrar(g, "", passthroughMW)

	noopH := func(c echo.Context) error { return nil }
	r.GET("/a", noopH, Public())
	r.POST("/b", noopH, Public())
	r.PUT("/c", noopH, Public())
	r.PATCH("/d", noopH, Public())
	r.DELETE("/e", noopH, Public())

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

func TestRegistrar_AppliesInjectedMiddleware(t *testing.T) {
	var capturedRule Rule
	mwInvoked := 0
	captureMW := func(rule Rule) echo.MiddlewareFunc {
		capturedRule = rule
		return func(next echo.HandlerFunc) echo.HandlerFunc {
			return func(c echo.Context) error {
				mwInvoked++
				return next(c)
			}
		}
	}

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, "/api", captureMW)

	r.GET("/x", func(c echo.Context) error { return c.NoContent(http.StatusOK) }, Authenticated())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/x", nil)
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, mwInvoked, "injected middleware must be invoked once per request")
	assert.False(t, capturedRule.IsPublic(), "rule must be passed to the mw factory")
}
