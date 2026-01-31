package server

import (
	"berth/internal/common"
	"berth/models"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type UserAPIHandler struct {
	service *Service
	db      *gorm.DB
}

type ListServersResponse struct {
	Success bool                     `json:"success"`
	Data    ListServersResponseData  `json:"data"`
}

type ListServersResponseData struct {
	Servers []models.ServerInfo `json:"servers"`
}

type ServerStatisticsResponse struct {
	Success bool                         `json:"success"`
	Data    ServerStatisticsResponseData `json:"data"`
}

type ServerStatisticsResponseData struct {
	Statistics models.StackStatistics `json:"statistics"`
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

	ctx := c.Request().Context()
	servers, err := h.service.ListServersForUser(ctx, userID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch servers")
	}

	return common.SendSuccess(c, ListServersResponse{
		Success: true,
		Data: ListServersResponseData{
			Servers: servers,
		},
	})
}

func (h *UserAPIHandler) GetServerStatistics(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	statistics, err := h.service.GetServerStatistics(ctx, userID, serverID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch server statistics")
	}

	return common.SendSuccess(c, ServerStatisticsResponse{
		Success: true,
		Data: ServerStatisticsResponseData{
			Statistics: *statistics,
		},
	})
}
