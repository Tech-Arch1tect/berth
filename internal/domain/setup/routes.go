package setup

import "github.com/labstack/echo/v4"

func (h *Handler) RegisterPublicRoutes(e *echo.Echo) {
	e.GET("/setup/admin", h.ShowSetup)
	e.POST("/setup/admin", h.CreateAdmin)
}
