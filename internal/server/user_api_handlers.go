package server

import (
	"brx-starter-kit/internal/common"
	"github.com/labstack/echo/v4"
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
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	servers, err := h.service.ListServersForUser(userID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch servers")
	}

	return common.SendSuccess(c, map[string]any{
		"servers": servers,
	})
}
