package server

import (
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

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
		return response.Internal(c, "Failed to fetch servers")
	}

	return response.OK(c, AdminListServersData{Servers: servers})
}

func (h *APIHandler) GetServer(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServerResponse(id)
	if err != nil {
		return response.NotFound(c, "Server not found")
	}

	return response.OK(c, GetServerData{Server: *server})
}

func (h *APIHandler) CreateServer(c echo.Context) error {
	var req AdminCreateServerRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	server := req.ToServer()
	if err := h.service.CreateServer(server); err != nil {
		return response.Internal(c, "Failed to create server")
	}

	return response.Created(c, AdminCreateServerData{Server: server.ToResponse()})
}

func (h *APIHandler) UpdateServer(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req AdminUpdateServerRequest
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	updates := req.ToServer()

	if updates.AccessToken == "" {
		existing, err := h.service.GetServer(id)
		if err != nil {
			return response.NotFound(c, "Server not found")
		}
		updates.AccessToken = existing.AccessToken
	}

	server, err := h.service.UpdateServer(id, updates)
	if err != nil {
		return response.Internal(c, "Failed to update server")
	}

	return response.OK(c, AdminUpdateServerData{Server: server.ToResponse()})
}

func (h *APIHandler) DeleteServer(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	if err := h.service.DeleteServer(id); err != nil {
		return response.Internal(c, "Failed to delete server")
	}

	return response.OK(c, MessageData{Message: "Server deleted successfully"})
}

func (h *APIHandler) TestConnection(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServer(id)
	if err != nil {
		return response.NotFound(c, "Server not found")
	}

	if err := h.service.TestServerConnection(server); err != nil {
		return response.ServiceUnavailable(c, "Connection test failed: "+err.Error())
	}

	return response.OK(c, MessageData{Message: "Connection successful"})
}
