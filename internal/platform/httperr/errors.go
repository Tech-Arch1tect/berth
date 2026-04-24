package httperr

import (
	"fmt"
	"net/http"
	"strings"

	"berth/internal/inertia"
	"github.com/labstack/echo/v4"
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

		accept := c.Request().Header.Get("Accept")
		if strings.Contains(accept, "text/html") || c.Request().Header.Get("X-Inertia") == "true" {
			_ = inertiaSvc.Render(c, "Errors/Generic", map[string]any{
				"code":    code,
				"message": fmt.Sprintf("%v", msg),
			})
			return
		}

		_ = c.JSON(code, map[string]any{
			"error": fmt.Sprintf("%v", msg),
			"code":  code,
		})
	}
}
