package authz

import (
	"net/http"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func noop(c echo.Context) error { return nil }

func TestAuditRoutes_AllCovered(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/servers", noop, Authenticated())
	r.POST("/servers", noop, Authenticated())

	err := AuditRoutes(e, r)
	assert.NoError(t, err)
}

func TestAuditRoutes_MustNotPanicWhenCovered(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/things", noop, Public())

	assert.NotPanics(t, func() {
		MustAuditRoutes(e, r)
	})
}

func TestAuditRoutes_DirectRouteIsViolation(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/things", noop, Authenticated())

	e.GET("/api/bypass", noop)

	err := AuditRoutes(e, r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "GET /api/bypass")
	assert.NotContains(t, err.Error(), "GET /api/things")
}

func TestAuditRoutes_MustPanicOnViolation(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/things", noop, Authenticated())

	e.GET("/api/bypass", noop)

	assert.Panics(t, func() {
		MustAuditRoutes(e, r)
	})
}

func TestAuditRoutes_NonAPIRoutesIgnored(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/things", noop, Public())

	e.GET("/healthz", noop)
	e.GET("/build/*", noop)

	err := AuditRoutes(e, r)
	assert.NoError(t, err)
}

func TestAuditRoutes_WSRouteIsViolation(t *testing.T) {
	e := echo.New()
	e.GET("/ws/events", noop)

	err := AuditRoutes(e)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "GET /ws/events")
}

func TestAuditRoutes_WSRouteCoveredByRegistrar(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/ws")
	r := NewRegistrar(g, engine, "/ws")
	r.GET("/events", noop, Authenticated())

	err := AuditRoutes(e, r)
	assert.NoError(t, err)
}

func TestAuditRoutes_ErrorMessageSorted(t *testing.T) {
	e := echo.New()
	e.POST("/api/z", noop)
	e.GET("/api/a", noop)

	err := AuditRoutes(e)
	require.Error(t, err)

	msg := err.Error()
	posA := indexSubstr(msg, "GET /api/a")
	posZ := indexSubstr(msg, "POST /api/z")
	assert.True(t, posA >= 0, "GET /api/a missing from error")
	assert.True(t, posZ >= 0, "POST /api/z missing from error")
	assert.Less(t, posA, posZ, "routes should be sorted in error message")
}

func TestAuditRoutes_MultipleRegistrars(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g1 := e.Group("/api")
	r1 := NewRegistrar(g1, engine, "/api")
	r1.GET("/servers", noop, Authenticated())

	g2 := e.Group("/ws")
	r2 := NewRegistrar(g2, engine, "/ws")
	r2.GET("/events", noop, Authenticated())

	err := AuditRoutes(e, r1, r2)
	assert.NoError(t, err)
}

func TestAuditRoutes_NilRegistrarsHandledGracefully(t *testing.T) {
	e := echo.New()
	e.GET("/healthz", noop)

	err := AuditRoutes(e)
	assert.NoError(t, err)
}

func indexSubstr(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestAuditRoutes_DeduplicatesDuplicateEchoRoutes(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/things", noop, Authenticated())

	e.GET("/api/extra", noop)
	e.GET("/api/extra", noop)

	err := AuditRoutes(e, r)
	require.Error(t, err)

	count := 0
	msg := err.Error()
	needle := "GET /api/extra"
	for i := 0; i < len(msg)-len(needle)+1; i++ {
		if msg[i:i+len(needle)] == needle {
			count++
			i += len(needle) - 1
		}
	}
	assert.Equal(t, 1, count, "duplicate route should appear only once in error")
}

func TestAuditRoutes_DirectHTTPMethodsAllCovered(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/r", noop, Public())
	r.POST("/r", noop, Public())
	r.PUT("/r", noop, Public())
	r.PATCH("/r", noop, Public())
	r.DELETE("/r", noop, Public())

	err := AuditRoutes(e, r)
	assert.NoError(t, err)
}

func TestAuditRoutes_PartialMethodCoverage(t *testing.T) {
	f := seedFixture(t)
	engine := NewEngine(f.db, zap.NewNop())

	e := echo.New()
	g := e.Group("/api")
	r := NewRegistrar(g, engine, "/api")
	r.GET("/r", noop, Authenticated())

	e.POST("/api/r", noop)

	err := AuditRoutes(e, r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "POST /api/r")
	assert.NotContains(t, err.Error(), http.MethodGet)
}
