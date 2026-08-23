package server

import (
	"errors"
	"fmt"
	"net/http"

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

	tokenRotated := req.AccessToken != ""
	backupPasswordChanged := req.BackupPassword != ""

	server, err := h.service.UpdateServer(c.Request().Context(), id, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrServerNotFound):
			return response.NotFound(c, err.Error())
		case errors.Is(err, ErrServerBackupPasswordRequired), errors.Is(err, ErrServerS3BucketNotFound):
			return response.BadRequest(c, err.Error())
		case errors.Is(err, ErrBackupStorageBusy), errors.Is(err, ErrBackupStorageHasHistory):
			return response.Conflict(c, err.Error())
		case errors.Is(err, ErrBackupStorageUnavailable):
			return response.ServiceUnavailable(c, err.Error())
		default:
			return response.Internal(c, "Failed to update server")
		}
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

func (h *APIHandler) GetAgentAuthority(c echo.Context) error {
	status, err := h.service.AgentAuthorityStatus()
	if err != nil {
		return response.Internal(c, "Failed to read the agent certificate authority")
	}
	return response.OK(c, AgentAuthorityData{Authority: status})
}

func (h *APIHandler) ReissueClientCertificate(c echo.Context) error {
	if err := h.service.ReissueClientCertificate(); err != nil {
		h.audit(c, security.EventAgentClientCertificateReissued, 0, "", false, err.Error())
		return response.Internal(c, "Failed to reissue the client certificate")
	}

	h.audit(c, security.EventAgentClientCertificateReissued, 0, "", true, "")

	return response.OK(c, MessageData{Message: "Client certificate reissued"})
}

func (h *APIHandler) RotateAgentAuthority(c echo.Context) error {
	if err := h.service.RotateAgentAuthority(); err != nil {
		h.audit(c, security.EventAgentAuthorityRotated, 0, "", false, err.Error())
		return response.Internal(c, "Failed to rotate the certificate authority")
	}

	h.audit(c, security.EventAgentAuthorityRotated, 0, "", true, "")

	return response.OK(c, MessageData{Message: "Certificate authority rotated. Every agent needs a new bundle installed."})
}

func (h *APIHandler) IssueAgentBundle(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServer(id)
	if err != nil {
		return response.NotFound(c, "Server not found")
	}

	bundle, err := h.service.IssueAgentBundle(id)
	if err != nil {
		h.audit(c, security.EventServerAgentCertificateIssued, server.ID, server.Name, false, err.Error())
		return response.Internal(c, "Failed to issue the agent certificate bundle")
	}

	h.audit(c, security.EventServerAgentCertificateIssued, server.ID, server.Name, true, "")

	c.Response().Header().Set("Cache-Control", "no-store")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", bundleFilename(server)))
	return c.Blob(http.StatusOK, "application/gzip", bundle)
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
