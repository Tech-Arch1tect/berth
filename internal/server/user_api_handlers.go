package server

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type UserAPIHandler struct {
	service *Service
}

func NewUserAPIHandler(service *Service) *UserAPIHandler {
	return &UserAPIHandler{
		service: service,
	}
}

func (h *UserAPIHandler) ListServers(c echo.Context) error {
	servers, err := h.service.ListServers()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch servers",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"servers": servers,
	})
}
