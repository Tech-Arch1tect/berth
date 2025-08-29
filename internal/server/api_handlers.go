package server

import (
	"berth/internal/common"
	"berth/models"

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

	return common.SendSuccess(c, map[string]any{
		"servers": servers,
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
	var server models.Server
	if err := common.BindRequest(c, &server); err != nil {
		return err
	}

	if err := h.service.CreateServer(&server); err != nil {
		return common.SendInternalError(c, "Failed to create server")
	}

	response := server.ToResponse()
	return common.SendCreated(c, map[string]any{
		"server": response,
	})
}

func (h *APIHandler) UpdateServer(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var updates models.Server
	if err := common.BindRequest(c, &updates); err != nil {
		return err
	}

	if updates.AccessToken == "" {
		existing, err := h.service.GetServer(id)
		if err != nil {
			return common.SendNotFound(c, "Server not found")
		}
		updates.AccessToken = existing.AccessToken
	}

	server, err := h.service.UpdateServer(id, &updates)
	if err != nil {
		return common.SendInternalError(c, "Failed to update server")
	}

	response := server.ToResponse()
	return common.SendSuccess(c, map[string]any{
		"server": response,
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

	return common.SendMessage(c, "Server deleted successfully")
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

	return common.SendMessage(c, "Connection successful")
}
