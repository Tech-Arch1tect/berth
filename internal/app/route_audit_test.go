package app_test

import (
	"testing"

	"berth/internal/app"
	"berth/internal/app/apptest"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestBootRouteAuditCleanBoot(t *testing.T) {
	assert.NotPanics(t, func() {
		apptest.Boot(t)
	})
}

func TestBootRouteAuditPanicsOnUnguardedRoute(t *testing.T) {
	assert.PanicsWithError(t,
		"authz: unguarded routes: GET /api/v1/unguarded-audit-canary",
		func() {
			apptest.Boot(t, apptest.WithBeforeRoutes(func(g *app.Graph) {
				g.Echo.GET("/api/v1/unguarded-audit-canary", func(c echo.Context) error {
					return c.NoContent(200)
				})
			}))
		})
}
