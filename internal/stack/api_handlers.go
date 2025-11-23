package stack

import (
	"berth/internal/agent"
	"berth/internal/common"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type APIHandler struct {
	service  *Service
	agentSvc *agent.Service
	logger   *logging.Service
}

func NewAPIHandler(service *Service, agentSvc *agent.Service, logger *logging.Service) *APIHandler {
	return &APIHandler{
		service:  service,
		agentSvc: agentSvc,
		logger:   logger,
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

type PreviewComposeResponse struct {
	Original string `json:"original"`
	Preview  string `json:"preview"`
}

type stackPermissionContext struct {
	UserID    uint
	ServerID  uint
	StackName string
	Server    *models.Server
}

func (h *APIHandler) withStackManagePermission(c echo.Context, handler func(echo.Context, *stackPermissionContext) error) error {
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
		h.logger.Error("failed to check stack permissions",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		h.logger.Warn("insufficient permissions for stack management",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return common.SendForbidden(c, "Insufficient permissions to modify this stack")
	}

	server, err := h.service.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		h.logger.Error("failed to get server",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return common.SendInternalError(c, "Failed to get server")
	}

	ctx := &stackPermissionContext{
		UserID:    userID,
		ServerID:  serverID,
		StackName: stackname,
		Server:    server,
	}

	return handler(c, ctx)
}

func (h *APIHandler) PreviewComposeChanges(c echo.Context) error {
	return h.withStackManagePermission(c, func(c echo.Context, ctx *stackPermissionContext) error {
		var req UpdateComposeRequest
		if err := common.BindRequest(c, &req); err != nil {
			return err
		}

		payload := map[string]any{
			"stack_name": ctx.StackName,
			"changes":    req.Changes,
		}

		resp, err := h.agentSvc.MakeRequest(c.Request().Context(), ctx.Server, "POST", "/compose/preview", payload)
		if err != nil {
			h.logger.Error("agent request failed for compose preview",
				zap.Error(err),
				zap.Uint("server_id", ctx.ServerID),
				zap.String("stack_name", ctx.StackName),
			)
			return common.SendInternalError(c, "Failed to generate preview: "+err.Error())
		}
		defer resp.Body.Close()

		var envelope struct {
			Data PreviewComposeResponse `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
			h.logger.Error("failed to parse agent preview response",
				zap.Error(err),
				zap.Uint("server_id", ctx.ServerID),
				zap.String("stack_name", ctx.StackName),
			)
			return common.SendInternalError(c, "Failed to parse preview response")
		}

		h.logger.Info("compose preview generated successfully",
			zap.Uint("user_id", ctx.UserID),
			zap.Uint("server_id", ctx.ServerID),
			zap.String("stack_name", ctx.StackName),
		)

		return common.SendSuccess(c, envelope.Data)
	})
}

func (h *APIHandler) UpdateCompose(c echo.Context) error {
	return h.withStackManagePermission(c, func(c echo.Context, ctx *stackPermissionContext) error {
		var req UpdateComposeRequest
		if err := common.BindRequest(c, &req); err != nil {
			return err
		}

		if err := h.applyComposeChanges(c.Request().Context(), ctx, &req.Changes); err != nil {
			h.logger.Error("failed to apply compose changes",
				zap.Error(err),
				zap.Uint("user_id", ctx.UserID),
				zap.Uint("server_id", ctx.ServerID),
				zap.String("stack_name", ctx.StackName),
			)
			return common.SendInternalError(c, err.Error())
		}

		h.logger.Info("compose file updated successfully",
			zap.Uint("user_id", ctx.UserID),
			zap.Uint("server_id", ctx.ServerID),
			zap.String("stack_name", ctx.StackName),
		)

		return common.SendSuccess(c, map[string]string{
			"message": "Compose file updated successfully",
		})
	})
}

func (h *APIHandler) applyComposeChanges(ctx context.Context, permCtx *stackPermissionContext, changes *ComposeChanges) error {
	payload := map[string]any{
		"stack_name": permCtx.StackName,
		"changes":    changes,
	}

	resp, err := h.agentSvc.MakeRequest(ctx, permCtx.Server, "PATCH", "/compose", payload)
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
