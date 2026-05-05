package validation

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type RequestValidator interface {
	Validate() error
}

func BindAndValidate(c echo.Context, req RequestValidator) error {
	if err := c.Bind(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := req.Validate(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error()).SetInternal(err)
	}

	return nil
}

func BindRequest[T any](c echo.Context, req *T) error {
	if err := c.Bind(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	return nil
}

func ErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	if he, ok := err.(*echo.HTTPError); ok {
		if msg, ok := he.Message.(string); ok {
			return msg
		}
	}
	return err.Error()
}
