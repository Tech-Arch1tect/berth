package stack

import (
	"net/http"
	"strconv"

	"brx-starter-kit/models"
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

func (h *APIHandler) ListServerStacks(c echo.Context) error {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	stacks, err := h.service.ListStacksForServer(c.Request().Context(), userModel.ID, uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"stacks": stacks,
	})
}

func (h *APIHandler) GetStackDetails(c echo.Context) error {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

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

	stackDetails, err := h.service.GetStackDetails(c.Request().Context(), userModel.ID, uint(serverID), stackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, stackDetails)
}

func (h *APIHandler) GetStackNetworks(c echo.Context) error {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

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

	networks, err := h.service.GetStackNetworks(c.Request().Context(), userModel.ID, uint(serverID), stackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, networks)
}

func (h *APIHandler) GetStackVolumes(c echo.Context) error {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

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

	volumes, err := h.service.GetStackVolumes(c.Request().Context(), userModel.ID, uint(serverID), stackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, volumes)
}

func (h *APIHandler) GetStackEnvironmentVariables(c echo.Context) error {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

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

	environmentVariables, err := h.service.GetStackEnvironmentVariables(c.Request().Context(), userModel.ID, uint(serverID), stackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, environmentVariables)
}
