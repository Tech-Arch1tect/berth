package common

import (
	"github.com/labstack/echo/v4"
)

type RequestValidator interface {
	Validate() error
}

func BindAndValidate[T RequestValidator](c echo.Context, req T) error {
	if err := c.Bind(&req); err != nil {
		return SendBadRequest(c, "Invalid request format")
	}

	if err := req.Validate(); err != nil {
		return SendBadRequest(c, err.Error())
	}

	return nil
}

func BindRequest[T any](c echo.Context, req *T) error {
	if err := c.Bind(req); err != nil {
		return SendBadRequest(c, "Invalid request format")
	}

	return nil
}
