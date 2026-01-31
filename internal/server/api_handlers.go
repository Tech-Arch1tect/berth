package server

import (
	"berth/internal/common"
	"net/http"

	"github.com/labstack/echo/v4"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

func (h *APIHandler) ListServers(c echo.Context) error {
	servers, err := h.service.ListServers()
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch servers")
	}

	return c.JSON(http.StatusOK, AdminListServersResponse{
		Success: true,
		Data: AdminListServersResponseData{
			Servers: servers,
		},
	})
}

func (h *APIHandler) GetServer(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServerResponse(id)
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	return common.SendSuccess(c, map[string]any{
		"server": server,
	})
}

func (h *APIHandler) CreateServer(c echo.Context) error {
	var req AdminCreateServerRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	server := req.ToServer()
	if err := h.service.CreateServer(server); err != nil {
		if err.Error() == "access token is required" {
			return common.SendBadRequest(c, err.Error())
		}
		return common.SendInternalError(c, "Failed to create server")
	}

	return c.JSON(http.StatusCreated, AdminCreateServerResponse{
		Success: true,
		Data: AdminCreateServerResponseData{
			Server: server.ToResponse(),
		},
	})
}

func (h *APIHandler) UpdateServer(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req AdminUpdateServerRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	updates := req.ToServer()

	if updates.AccessToken == "" {
		existing, err := h.service.GetServer(id)
		if err != nil {
			return common.SendNotFound(c, "Server not found")
		}
		updates.AccessToken = existing.AccessToken
	}

	server, err := h.service.UpdateServer(id, updates)
	if err != nil {
		return common.SendInternalError(c, "Failed to update server")
	}

	return c.JSON(http.StatusOK, AdminUpdateServerResponse{
		Success: true,
		Data: AdminUpdateServerResponseData{
			Server: server.ToResponse(),
		},
	})
}

func (h *APIHandler) DeleteServer(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	if err := h.service.DeleteServer(id); err != nil {
		return common.SendInternalError(c, "Failed to delete server")
	}

	return c.JSON(http.StatusOK, AdminDeleteServerResponse{
		Success: true,
		Data: AdminDeleteServerResponseData{
			Message: "Server deleted successfully",
		},
	})
}

func (h *APIHandler) TestConnection(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServer(id)
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	if err := h.service.TestServerConnection(server); err != nil {
		return common.SendError(c, 503, "Connection test failed: "+err.Error())
	}

	return c.JSON(http.StatusOK, AdminTestConnectionResponse{
		Success: true,
		Data: AdminTestConnectionResponseData{
			Message: "Connection successful",
		},
	})
}
