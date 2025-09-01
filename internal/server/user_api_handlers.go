package server

import (
	"berth/internal/common"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type UserAPIHandler struct {
	service      *Service
	db           *gorm.DB
	stackService StackService
}

func NewUserAPIHandler(service *Service, db *gorm.DB, stackService StackService) *UserAPIHandler {
	return &UserAPIHandler{
		service:      service,
		db:           db,
		stackService: stackService,
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

func (h *UserAPIHandler) ListServersWithStatistics(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	servers, err := h.service.ListServersForUserWithStatistics(userID, h.stackService)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch servers with statistics")
	}

	return common.SendSuccess(c, map[string]any{
		"servers": servers,
	})
}
