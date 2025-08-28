package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
)

func SetupErrorHandler(e *echo.Echo, inertiaSvc *inertia.Service) {
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		var (
			code     = http.StatusInternalServerError
			msg  any = "Internal Server Error"
		)

		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
			msg = he.Message
		}

		// For web requests (browsers), render error page
		accept := c.Request().Header.Get("Accept")
		if strings.Contains(accept, "text/html") || c.Request().Header.Get("X-Inertia") == "true" {
			_ = inertiaSvc.Render(c, "Errors/Generic", map[string]any{
				"code":    code,
				"message": fmt.Sprintf("%v", msg),
			})
			return
		}

		// For API/JSON requests, return JSON
		_ = c.JSON(code, map[string]any{
			"error": fmt.Sprintf("%v", msg),
			"code":  code,
		})
	}
}
