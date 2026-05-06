package server

import (
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

	"github.com/labstack/echo/v4"
)

type UserAPIHandler struct {
	service *Service
}

type ListServersData struct {
	Servers []ServerInfo `json:"servers"`
}

type ServerStatisticsData struct {
	Statistics StackStatistics `json:"statistics"`
}

func NewUserAPIHandler(service *Service) *UserAPIHandler {
	return &UserAPIHandler{
		service: service,
	}
}

func (h *UserAPIHandler) ListServers(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	servers, err := h.service.ListServersForUser(ctx, userID)
	if err != nil {
		return response.Internal(c, "Failed to fetch servers")
	}

	return response.OK(c, ListServersData{Servers: servers})
}

func (h *UserAPIHandler) GetServerStatistics(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	statistics, err := h.service.GetServerStatistics(ctx, userID, serverID)
	if err != nil {
		return response.Internal(c, "Failed to fetch server statistics")
	}

	return response.OK(c, ServerStatisticsData{Statistics: *statistics})
}
