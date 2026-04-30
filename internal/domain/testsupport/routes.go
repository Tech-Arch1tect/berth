//go:build e2e

package testsupport

import (
	"net"
	"net/http"

	"berth/internal/pkg/config"

	"github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, h *Handler, cfg *config.Config) {
	g := e.Group("/__test__", guard(cfg))
	g.POST("/reset", h.Reset)
	g.POST("/users", h.SeedUser)
	g.POST("/users/:id/totp", h.EnableTOTP)
	g.POST("/servers", h.SeedServer)
	g.POST("/agents/:id/handlers", h.RegisterAgentHandler)
	g.POST("/agents/:id/reset", h.ResetAgent)
}

func guard(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !cfg.Custom.E2EMode {
				return echo.NewHTTPError(http.StatusNotFound)
			}
			if !isLoopback(c.RealIP()) {
				return echo.NewHTTPError(http.StatusForbidden)
			}
			return next(c)
		}
	}
}

func isLoopback(addr string) bool {
	if addr == "" {
		return false
	}
	ip := net.ParseIP(addr)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}
