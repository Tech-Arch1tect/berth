package httperr

import (
	"fmt"
	"net/http"

	"berth/internal/pkg/response"

	"github.com/labstack/echo/v4"
)

func SetupErrorHandler(e *echo.Echo) {
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		status := http.StatusInternalServerError
		message := "Internal Server Error"

		if he, ok := err.(*echo.HTTPError); ok {
			status = he.Code
			message = fmt.Sprintf("%v", he.Message)
		}

		_ = response.Err(c, status, codeForStatus(status), message)
	}
}

func codeForStatus(status int) string {
	switch status {
	case http.StatusBadRequest:
		return response.CodeBadRequest
	case http.StatusUnauthorized:
		return response.CodeUnauthorized
	case http.StatusForbidden:
		return response.CodeForbidden
	case http.StatusNotFound:
		return response.CodeNotFound
	case http.StatusConflict:
		return response.CodeConflict
	case http.StatusUnprocessableEntity:
		return response.CodeUnprocessableEntity
	case http.StatusTooManyRequests:
		return response.CodeTooManyRequests
	case http.StatusBadGateway:
		return response.CodeBadGateway
	case http.StatusServiceUnavailable:
		return response.CodeServiceUnavailable
	default:
		return response.CodeInternal
	}
}
