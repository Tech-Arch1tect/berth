package stack

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/session"
)

type WebAPIHandler struct {
	service *Service
}

func NewWebAPIHandler(service *Service) *WebAPIHandler {
	return &WebAPIHandler{
		service: service,
	}
}

func (h *WebAPIHandler) ListServerStacks(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	stacks, err := h.service.ListStacksForServer(c.Request().Context(), userID, uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"stacks": stacks,
	})
}

func (h *WebAPIHandler) GetStackDetails(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	serverID, err := strconv.ParseUint(c.Param("serverid"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	stackName := c.Param("stackname")
	if stackName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Stack name is required",
		})
	}

	stackDetails, err := h.service.GetStackDetails(c.Request().Context(), userID, uint(serverID), stackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, stackDetails)
}
