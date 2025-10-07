package stack

import (
	"berth/internal/agent"
	"berth/internal/common"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

type APIHandler struct {
	service  *Service
	agentSvc *agent.Service
}

func NewAPIHandler(service *Service, agentSvc *agent.Service) *APIHandler {
	return &APIHandler{
		service:  service,
		agentSvc: agentSvc,
	}
}

func (h *APIHandler) ListServerStacks(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	stacks, err := h.service.ListStacksForServer(c.Request().Context(), userID, serverID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, map[string]any{
		"stacks": stacks,
	})
}

func (h *APIHandler) GetStackDetails(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	stackDetails, err := h.service.GetStackDetails(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, stackDetails)
}

func (h *APIHandler) GetStackNetworks(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	networks, err := h.service.GetStackNetworks(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, networks)
}

func (h *APIHandler) GetStackVolumes(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	volumes, err := h.service.GetStackVolumes(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, volumes)
}

func (h *APIHandler) GetContainerImageDetails(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	imageDetails, err := h.service.GetContainerImageDetails(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, imageDetails)
}

func (h *APIHandler) GetStackEnvironmentVariables(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	environmentVariables, err := h.service.GetStackEnvironmentVariables(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, environmentVariables)
}

func (h *APIHandler) GetStackStats(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	stackStats, err := h.service.GetStackStats(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, stackStats)
}

func (h *APIHandler) CheckPermissions(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	permissions, err := h.service.rbacSvc.GetUserStackPermissions(userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, "Failed to get user permissions")
	}

	return common.SendSuccess(c, map[string]any{
		"permissions": permissions,
	})
}

type ComposeChanges struct {
	ServiceImageUpdates []ServiceImageUpdate `json:"service_image_updates,omitempty"`
	ServicePortUpdates  []ServicePortUpdate  `json:"service_port_updates,omitempty"`
}

type ServiceImageUpdate struct {
	ServiceName string `json:"service_name"`
	NewImage    string `json:"new_image,omitempty"`
	NewTag      string `json:"new_tag,omitempty"`
}

type ServicePortUpdate struct {
	ServiceName string   `json:"service_name"`
	Ports       []string `json:"ports"`
}

type UpdateComposeRequest struct {
	Changes ComposeChanges `json:"changes" binding:"required"`
}

func (h *APIHandler) UpdateCompose(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	hasPermission, err := h.service.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "stacks.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to modify this stack")
	}

	var req UpdateComposeRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if err := h.applyComposeChanges(c.Request().Context(), userID, serverID, stackname, &req.Changes); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, map[string]string{
		"message": "Compose file updated successfully",
	})
}

func (h *APIHandler) applyComposeChanges(ctx context.Context, userID uint, serverID uint, stackName string, changes *ComposeChanges) error {
	server, err := h.service.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	payload := map[string]any{
		"stack_name": stackName,
		"changes":    changes,
	}

	resp, err := h.agentSvc.MakeRequest(ctx, server, "PATCH", "/compose", payload)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
			if msg, ok := errResp["error"].(string); ok {
				return fmt.Errorf("agent returned error: %s", msg)
			}
		}
		return fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return nil
}
