package server

import (
	"brx-starter-kit/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

func (h *APIHandler) ListServers(c echo.Context) error {
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

func (h *APIHandler) GetServer(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, map[string]string{
			"error": "Server not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"server": server,
	})
}

func (h *APIHandler) CreateServer(c echo.Context) error {
	var server models.Server
	if err := c.Bind(&server); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request data",
		})
	}

	if err := h.service.CreateServer(&server); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create server",
		})
	}

	return c.JSON(http.StatusCreated, map[string]any{
		"server": server,
	})
}

func (h *APIHandler) UpdateServer(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	var updates models.Server
	if err := c.Bind(&updates); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request data",
		})
	}

	// If access_token is empty, don't update it (keep existing)
	if updates.AccessToken == "" {
		existing, err := h.service.GetServer(uint(id))
		if err != nil {
			return echo.NewHTTPError(http.StatusNotFound, map[string]string{
				"error": "Server not found",
			})
		}
		updates.AccessToken = existing.AccessToken
	}

	server, err := h.service.UpdateServer(uint(id), &updates)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update server",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"server": server,
	})
}

func (h *APIHandler) DeleteServer(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	if err := h.service.DeleteServer(uint(id)); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete server",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Server deleted successfully",
	})
}

func (h *APIHandler) TestConnection(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, map[string]string{
			"error": "Server not found",
		})
	}

	if err := h.service.TestServerConnection(server); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error":   "Connection test failed",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "Connection successful",
	})
}
