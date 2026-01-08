package maintenance

import (
	"berth/internal/common"

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

	return common.SendSuccess(c, info)
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

	return common.SendSuccess(c, result)
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

	return common.SendSuccess(c, result)
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

	return common.SendSuccess(c, map[string]any{
		"maintenance": map[string]bool{
			"read":  hasReadPermission,
			"write": hasWritePermission,
		},
	})
}
