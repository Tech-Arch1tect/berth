package server

import (
	"berth/internal/domain/authz"
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
	scope, ok := authz.GetScopeSet(c)
	if !ok {
		return response.Internal(c, "Failed to fetch servers")
	}

	servers, err := h.service.ListServersByIDs(scope.ServerIDs())
	if err != nil {
		return response.Internal(c, "Failed to fetch servers")
	}

	return response.OK(c, ListServersData{Servers: servers})
}

func (h *UserAPIHandler) GetServer(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	if _, err := h.service.GetActiveServerForUser(ctx, serverID, p); err != nil {
		return response.NotFound(c, "Server not found")
	}

	serverInfo, err := h.service.GetServerResponse(serverID)
	if err != nil {
		return response.Internal(c, "Failed to fetch server")
	}

	return response.OK(c, GetServerData{Server: *serverInfo})
}

func (h *UserAPIHandler) GetServerStatistics(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	statistics, err := h.service.GetServerStatistics(ctx, p, serverID)
	if err != nil {
		return response.Internal(c, "Failed to fetch server statistics")
	}

	return response.OK(c, ServerStatisticsData{Statistics: *statistics})
}
