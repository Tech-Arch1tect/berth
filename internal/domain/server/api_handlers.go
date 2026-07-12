package server

import (
	"errors"

	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type serverAuditLogger interface {
	LogServerEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, serverName, ip string, success bool, failureReason string, metadata map[string]any) error
}

type APIHandler struct {
	service      *Service
	auditService serverAuditLogger
}

func NewAPIHandler(service *Service, auditService serverAuditLogger) *APIHandler {
	return &APIHandler{
		service:      service,
		auditService: auditService,
	}
}

func (h *APIHandler) audit(c echo.Context, eventType string, serverID uint, serverName string, success bool, failureReason string) {
	if h.auditService == nil {
		return
	}
	actorID, _ := session.GetCurrentUserID(c)
	_ = h.auditService.LogServerEvent(eventType, actorID, session.ResolveUsername(c), serverID, serverName, c.RealIP(), success, failureReason, nil)
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

	h.audit(c, security.EventServerCreated, server.ID, server.Name, true, "")

	return response.Created(c, AdminCreateServerData{Server: server.ToResponse()})
}

func (h *APIHandler) UpdateServer(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req AdminUpdateServerRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	updates := req.ToServer()

	tokenRotated := updates.AccessToken != ""
	backupPasswordChanged := updates.BackupPassword != ""
	if !tokenRotated || !backupPasswordChanged {
		existing, err := h.service.GetServer(id)
		if err != nil {
			return response.NotFound(c, "Server not found")
		}
		if !tokenRotated {
			updates.AccessToken = existing.AccessToken
		}
		if !backupPasswordChanged {
			updates.BackupPassword = existing.BackupPassword
		}
	}

	server, err := h.service.UpdateServer(id, updates)
	if err != nil {
		if errors.Is(err, ErrServerBackupPasswordRequired) {
			return response.BadRequest(c, err.Error())
		}
		return response.Internal(c, "Failed to update server")
	}

	h.audit(c, security.EventServerUpdated, server.ID, server.Name, true, "")
	if tokenRotated {
		h.audit(c, security.EventServerAccessTokenRegenerated, server.ID, server.Name, true, "")
	}
	if backupPasswordChanged {
		h.audit(c, security.EventServerBackupPasswordChanged, server.ID, server.Name, true, "")
	}

	return response.OK(c, AdminUpdateServerData{Server: server.ToResponse()})
}

func (h *APIHandler) DeleteServer(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var name string
	if srv, err := h.service.GetServer(id); err == nil {
		name = srv.Name
	}

	if err := h.service.DeleteServer(id); err != nil {
		return response.Internal(c, "Failed to delete server")
	}

	h.audit(c, security.EventServerDeleted, id, name, true, "")

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

	if err := h.service.TestServerConnection(c.Request().Context(), server); err != nil {
		h.audit(c, security.EventServerConnectionTestFailure, server.ID, server.Name, false, err.Error())
		return response.ServiceUnavailable(c, "Connection test failed: "+err.Error())
	}

	h.audit(c, security.EventServerConnectionTestSuccess, server.ID, server.Name, true, "")

	return response.OK(c, MessageData{Message: "Connection successful"})
}
