package logs

import (
	"net/http"
	"strconv"

	"brx-starter-kit/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) getUserID(c echo.Context) (uint, error) {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser != nil {
		if userModel, ok := currentUser.(models.User); ok {
			return userModel.ID, nil
		}
	}

	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return 0, echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	return userID, nil
}

func (h *Handler) GetStackLogs(c echo.Context) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	serverID := h.parseUintParam(c, "serverId", 0)
	if serverID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	stackName := c.Param("stackName")
	if stackName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Stack name is required",
		})
	}

	req := LogRequest{
		UserID:     userID,
		ServerID:   serverID,
		StackName:  stackName,
		Tail:       h.parseIntParam(c, "tail", 100),
		Since:      c.QueryParam("since"),
		Timestamps: h.parseBoolParam(c, "timestamps", true),
	}

	logs, err := h.service.GetStackLogs(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, logs)
}

func (h *Handler) GetContainerLogs(c echo.Context) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	serverID := h.parseUintParam(c, "serverId", 0)
	if serverID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	stackName := c.Param("stackName")
	containerName := c.Param("containerName")

	if stackName == "" || containerName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Stack name and container name are required",
		})
	}

	req := LogRequest{
		UserID:        userID,
		ServerID:      serverID,
		StackName:     stackName,
		ContainerName: containerName,
		Tail:          h.parseIntParam(c, "tail", 100),
		Since:         c.QueryParam("since"),
		Timestamps:    h.parseBoolParam(c, "timestamps", true),
	}

	logs, err := h.service.GetContainerLogs(c.Request().Context(), req)
	if err != nil {
		c.Logger().Error("Container logs error: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, logs)
}

func (h *Handler) parseIntParam(c echo.Context, param string, defaultValue int) int {
	if value := c.QueryParam(param); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultValue
}

func (h *Handler) parseBoolParam(c echo.Context, param string, defaultValue bool) bool {
	if value := c.QueryParam(param); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func (h *Handler) parseUintParam(c echo.Context, param string, defaultValue uint) uint {
	if value := c.Param(param); value != "" {
		if parsed, err := strconv.ParseUint(value, 10, 32); err == nil {
			return uint(parsed)
		}
	}
	return defaultValue
}
