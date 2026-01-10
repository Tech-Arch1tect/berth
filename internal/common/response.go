package common

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func SendSuccess(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, data)
}

func SendMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusOK, map[string]string{
		"message": message,
	})
}

func SendCreated(c echo.Context, data any) error {
	return c.JSON(http.StatusCreated, data)
}

func SendError(c echo.Context, statusCode int, message string) error {
	return c.JSON(statusCode, map[string]string{
		"error": message,
	})
}

func SendBadRequest(c echo.Context, message string) error {
	return SendError(c, http.StatusBadRequest, message)
}

func SendUnauthorized(c echo.Context, message string) error {
	return SendError(c, http.StatusUnauthorized, message)
}

func SendForbidden(c echo.Context, message string) error {
	return SendError(c, http.StatusForbidden, message)
}

func SendNotFound(c echo.Context, message string) error {
	return SendError(c, http.StatusNotFound, message)
}

func SendConflict(c echo.Context, message string) error {
	return SendError(c, http.StatusConflict, message)
}

func SendInternalError(c echo.Context, message string) error {
	return SendError(c, http.StatusInternalServerError, message)
}

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

func SuccessResponse(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func ErrorResponse(c echo.Context, statusCode int, message string, err error) error {
	resp := Response{
		Success: false,
		Message: message,
	}
	if err != nil {
		resp.Error = err.Error()
	}
	return c.JSON(statusCode, resp)
}
