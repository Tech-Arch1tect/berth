package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Response[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data"`
	Error   *Error `json:"error,omitempty"`
	Meta    *Meta  `json:"meta,omitempty"`
}

type Error struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

type Meta struct {
	Page       *int   `json:"page,omitempty"`
	PageSize   *int   `json:"pageSize,omitempty"`
	TotalCount *int   `json:"totalCount,omitempty"`
	RequestID  string `json:"requestId,omitempty"`
}

type ErrorResponseBody = Response[struct{}]

const (
	CodeBadRequest          = "bad_request"
	CodeUnauthorized        = "unauthorized"
	CodeForbidden           = "forbidden"
	CodeNotFound            = "not_found"
	CodeConflict            = "conflict"
	CodeUnprocessableEntity = "unprocessable_entity"
	CodeValidationFailed    = "validation_failed"
	CodeTooManyRequests     = "too_many_requests"
	CodeInternal            = "internal_error"
	CodeServiceUnavailable  = "service_unavailable"
)

func OK[T any](c echo.Context, data T) error {
	return c.JSON(http.StatusOK, Response[T]{Success: true, Data: data})
}

func Created[T any](c echo.Context, data T) error {
	return c.JSON(http.StatusCreated, Response[T]{Success: true, Data: data})
}

func Paginated[T any](c echo.Context, data T, meta Meta) error {
	return c.JSON(http.StatusOK, Response[T]{Success: true, Data: data, Meta: &meta})
}

func Err(c echo.Context, status int, code, message string) error {
	return ErrWithDetails(c, status, code, message, nil)
}

func ErrWithDetails(c echo.Context, status int, code, message string, details map[string]string) error {
	return c.JSON(status, ErrorResponseBody{
		Success: false,
		Data:    struct{}{},
		Error: &Error{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

func BadRequest(c echo.Context, message string) error {
	return Err(c, http.StatusBadRequest, CodeBadRequest, message)
}

func Unauthorized(c echo.Context, message string) error {
	return Err(c, http.StatusUnauthorized, CodeUnauthorized, message)
}

func Forbidden(c echo.Context, message string) error {
	return Err(c, http.StatusForbidden, CodeForbidden, message)
}

func NotFound(c echo.Context, message string) error {
	return Err(c, http.StatusNotFound, CodeNotFound, message)
}

func Conflict(c echo.Context, message string) error {
	return Err(c, http.StatusConflict, CodeConflict, message)
}

func UnprocessableEntity(c echo.Context, message string) error {
	return Err(c, http.StatusUnprocessableEntity, CodeUnprocessableEntity, message)
}

func Validation(c echo.Context, message string, details map[string]string) error {
	return ErrWithDetails(c, http.StatusBadRequest, CodeValidationFailed, message, details)
}

func TooManyRequests(c echo.Context, message string) error {
	return Err(c, http.StatusTooManyRequests, CodeTooManyRequests, message)
}

func Internal(c echo.Context, message string) error {
	return Err(c, http.StatusInternalServerError, CodeInternal, message)
}

func ServiceUnavailable(c echo.Context, message string) error {
	return Err(c, http.StatusServiceUnavailable, CodeServiceUnavailable, message)
}
