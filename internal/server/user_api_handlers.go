package server

import (
	"brx-starter-kit/models"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"gorm.io/gorm"
)

type UserAPIHandler struct {
	service *Service
	db      *gorm.DB
}

func NewUserAPIHandler(service *Service, db *gorm.DB) *UserAPIHandler {
	return &UserAPIHandler{
		service: service,
		db:      db,
	}
}

func (h *UserAPIHandler) ListServers(c echo.Context) error {
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

	servers, err := h.service.ListServersForUser(userModel.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch servers",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"servers": servers,
	})
}
