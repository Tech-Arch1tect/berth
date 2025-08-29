package common

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type RequestValidator interface {
	Validate() error
}

func BindAndValidate[T RequestValidator](c echo.Context, req T) error {
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := req.Validate(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return nil
}

func BindRequest[T any](c echo.Context, req *T) error {
	if err := c.Bind(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	return nil
}
