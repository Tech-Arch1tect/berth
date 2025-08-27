package operations

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

func (h *Handler) StartOperation(c echo.Context) error {
	serverIDStr := c.Param("serverId")
	stackName := c.Param("stackName")

	if serverIDStr == "" || stackName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server ID and stack name are required",
		})
	}

	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}

	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	var req OperationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request format",
		})
	}

	response, err := h.service.StartOperation(c.Request().Context(), userID, uint(serverID), stackName, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, response)
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
