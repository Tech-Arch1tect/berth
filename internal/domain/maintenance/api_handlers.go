package maintenance

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type MaintenancePermissions struct {
	Read  bool `json:"read"`
	Write bool `json:"write"`
}

type PermissionsData struct {
	Maintenance MaintenancePermissions `json:"maintenance"`
}

type maintenanceAuditLogger interface {
	Log(event security.LogEvent) error
}

type APIHandler struct {
	service      *Service
	auditService maintenanceAuditLogger
}

func NewAPIHandler(service *Service, auditService maintenanceAuditLogger) *APIHandler {
	return &APIHandler{
		service:      service,
		auditService: auditService,
	}
}

func (h *APIHandler) GetSystemInfo(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	info, err := h.service.GetSystemInfo(c.Request().Context(), p, serverID)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, MaintenanceInfo(*info))
}

func (h *APIHandler) PruneDocker(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	var request PruneRequest
	if err := validation.BindAndValidate(c, &request); err != nil {
		return err
	}

	result, err := h.service.PruneDocker(c.Request().Context(), p, serverID, &request)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	username := session.ResolveUsername(c)

	actorID := p.UserID()
	h.auditService.Log(security.LogEvent{
		EventType:     security.EventDockerPruneExecuted,
		Success:       true,
		ActorUserID:   &actorID,
		ActorUsername: username,
		ActorIP:       c.RealIP(),
		ServerID:      &serverID,
		Metadata: map[string]any{
			"prune_type": request.Type,
			"force":      request.Force,
			"all":        request.All,
		},
	})

	return response.OK(c, PruneResult(*result))
}

func (h *APIHandler) DeleteResource(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	var request DeleteRequest
	if err := validation.BindAndValidate(c, &request); err != nil {
		return err
	}

	result, err := h.service.DeleteResource(c.Request().Context(), p, serverID, &request)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	username := session.ResolveUsername(c)

	actorID := p.UserID()
	h.auditService.Log(security.LogEvent{
		EventType:     security.EventDockerResourceDeleted,
		Success:       true,
		ActorUserID:   &actorID,
		ActorUsername: username,
		ActorIP:       c.RealIP(),
		ServerID:      &serverID,
		Metadata: map[string]any{
			"resource_type": request.Type,
			"resource_id":   request.ID,
		},
	})

	return response.OK(c, DeleteResult(*result))
}

func (h *APIHandler) CheckPermissions(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	hasReadPermission, err := h.service.authzSvc.HasServerPermission(p, serverID, permnames.DockerMaintenanceRead)
	if err != nil {
		return response.Internal(c, "Failed to check read permissions")
	}

	hasWritePermission, err := h.service.authzSvc.HasServerPermission(p, serverID, permnames.DockerMaintenanceWrite)
	if err != nil {
		return response.Internal(c, "Failed to check write permissions")
	}

	return response.OK(c, PermissionsData{
		Maintenance: MaintenancePermissions{
			Read:  hasReadPermission,
			Write: hasWritePermission,
		},
	})
}
