package maintenance

import (
	"berth/internal/common"
	"berth/internal/security"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type MaintenancePermissions struct {
	Read  bool `json:"read"`
	Write bool `json:"write"`
}

type PermissionsResponse struct {
	Success bool                    `json:"success"`
	Data    PermissionsResponseData `json:"data"`
}

type PermissionsResponseData struct {
	Maintenance MaintenancePermissions `json:"maintenance"`
}

type APIHandler struct {
	service      *Service
	auditService *security.AuditService
	db           *gorm.DB
}

func NewAPIHandler(service *Service, auditService *security.AuditService, db *gorm.DB) *APIHandler {
	return &APIHandler{
		service:      service,
		auditService: auditService,
		db:           db,
	}
}

func (h *APIHandler) GetSystemInfo(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	info, err := h.service.GetSystemInfo(c.Request().Context(), userID, serverID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, MaintenanceInfo(*info))
}

func (h *APIHandler) PruneDocker(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	var request PruneRequest
	if err := c.Bind(&request); err != nil {
		return common.SendBadRequest(c, "Invalid request body")
	}

	if request.Type == "" {
		return common.SendBadRequest(c, "Prune type is required")
	}

	validTypes := map[string]bool{
		"images":      true,
		"containers":  true,
		"volumes":     true,
		"networks":    true,
		"build-cache": true,
		"system":      true,
	}

	if !validTypes[request.Type] {
		return common.SendBadRequest(c, "Invalid prune type")
	}

	result, err := h.service.PruneDocker(c.Request().Context(), userID, serverID, &request)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.Log(security.LogEvent{
		EventType:     security.EventDockerPruneExecuted,
		Success:       true,
		ActorUserID:   &userID,
		ActorUsername: username,
		ActorIP:       c.RealIP(),
		ServerID:      &serverID,
		Metadata: map[string]any{
			"prune_type": request.Type,
			"force":      request.Force,
			"all":        request.All,
		},
	})

	return common.SendSuccess(c, PruneResult(*result))
}

func (h *APIHandler) DeleteResource(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	var request DeleteRequest
	if err := c.Bind(&request); err != nil {
		return common.SendBadRequest(c, "Invalid request body")
	}

	if request.Type == "" {
		return common.SendBadRequest(c, "Resource type is required")
	}

	if request.ID == "" {
		return common.SendBadRequest(c, "Resource ID is required")
	}

	validTypes := map[string]bool{
		"image":     true,
		"container": true,
		"volume":    true,
		"network":   true,
	}

	if !validTypes[request.Type] {
		return common.SendBadRequest(c, "Invalid resource type")
	}

	result, err := h.service.DeleteResource(c.Request().Context(), userID, serverID, &request)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	user, _ := common.GetCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.Log(security.LogEvent{
		EventType:     security.EventDockerResourceDeleted,
		Success:       true,
		ActorUserID:   &userID,
		ActorUsername: username,
		ActorIP:       c.RealIP(),
		ServerID:      &serverID,
		Metadata: map[string]any{
			"resource_type": request.Type,
			"resource_id":   request.ID,
		},
	})

	return common.SendSuccess(c, DeleteResult(*result))
}

func (h *APIHandler) CheckPermissions(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	hasReadPermission, err := h.service.rbacSvc.UserHasAnyStackPermission(c.Request().Context(), userID, serverID, "docker.maintenance.read")
	if err != nil {
		return common.SendInternalError(c, "Failed to check read permissions")
	}

	hasWritePermission, err := h.service.rbacSvc.UserHasAnyStackPermission(c.Request().Context(), userID, serverID, "docker.maintenance.write")
	if err != nil {
		return common.SendInternalError(c, "Failed to check write permissions")
	}

	return common.SendSuccess(c, PermissionsResponse{
		Success: true,
		Data: PermissionsResponseData{
			Maintenance: MaintenancePermissions{
				Read:  hasReadPermission,
				Write: hasWritePermission,
			},
		},
	})
}
