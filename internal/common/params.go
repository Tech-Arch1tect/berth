package common

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func ParseUintParam(c echo.Context, paramName string) (uint, error) {
	value := c.Param(paramName)
	if value == "" {
		return 0, echo.NewHTTPError(http.StatusBadRequest, SendError(c, 400, fmt.Sprintf("%s is required", paramName)))
	}

	parsed, err := strconv.ParseUint(value, 10, 32)
	if err != nil {
		return 0, echo.NewHTTPError(http.StatusBadRequest, SendError(c, 400, fmt.Sprintf("Invalid %s: must be a positive integer", paramName)))
	}

	return uint(parsed), nil
}

func ParseIntParam(c echo.Context, paramName string) (int, error) {
	value := c.Param(paramName)
	if value == "" {
		return 0, echo.NewHTTPError(http.StatusBadRequest, SendError(c, 400, fmt.Sprintf("%s is required", paramName)))
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, echo.NewHTTPError(http.StatusBadRequest, SendError(c, 400, fmt.Sprintf("Invalid %s: must be an integer", paramName)))
	}

	return parsed, nil
}

func GetServerIDAndStackName(c echo.Context) (uint, string, error) {
	serverID, err := ParseUintParam(c, "serverid")
	if err != nil {
		return 0, "", err
	}

	stackname := c.Param("stackname")
	if stackname == "" {
		return 0, "", echo.NewHTTPError(http.StatusBadRequest, SendError(c, 400, "stackname is required"))
	}

	return serverID, stackname, nil
}

func GetQueryParam(c echo.Context, paramName string) string {
	return c.QueryParam(paramName)
}

func GetQueryParamWithDefault(c echo.Context, paramName, defaultValue string) string {
	value := c.QueryParam(paramName)
	if value == "" {
		return defaultValue
	}
	return value
}
