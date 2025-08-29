package common

import "net/http"

type HandlerError struct {
	Code       string         `json:"code"`
	Message    string         `json:"message"`
	HTTPStatus int            `json:"-"`
	Details    map[string]any `json:"details,omitempty"`
}

func (e *HandlerError) Error() string {
	return e.Message
}

func NewBadRequestError(message string) *HandlerError {
	return &HandlerError{
		Code:       "bad_request",
		Message:    message,
		HTTPStatus: http.StatusBadRequest,
	}
}

func NewUnauthorizedError(message string) *HandlerError {
	return &HandlerError{
		Code:       "unauthorized",
		Message:    message,
		HTTPStatus: http.StatusUnauthorized,
	}
}

func NewForbiddenError(message string) *HandlerError {
	return &HandlerError{
		Code:       "forbidden",
		Message:    message,
		HTTPStatus: http.StatusForbidden,
	}
}

func NewNotFoundError(message string) *HandlerError {
	return &HandlerError{
		Code:       "not_found",
		Message:    message,
		HTTPStatus: http.StatusNotFound,
	}
}

func NewInternalError(message string) *HandlerError {
	return &HandlerError{
		Code:       "internal_error",
		Message:    message,
		HTTPStatus: http.StatusInternalServerError,
	}
}

func NewValidationError(message string, details map[string]any) *HandlerError {
	return &HandlerError{
		Code:       "validation_error",
		Message:    message,
		HTTPStatus: http.StatusBadRequest,
		Details:    details,
	}
}
