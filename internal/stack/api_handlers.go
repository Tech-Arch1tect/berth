package stack

import (
	"berth/internal/agent"
	"berth/internal/common"

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

	unmask := c.QueryParam("unmask") == "true"

	h.logger.Debug("fetching stack environment variables",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.Bool("unmask", unmask),
	)

	environmentVariables, err := h.service.GetStackEnvironmentVariables(c.Request().Context(), userID, serverID, stackname, unmask)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	h.logger.Debug("returning environment variables",
		zap.Int("service_count", len(environmentVariables)),
		zap.Strings("services", func() []string {
			keys := make([]string, 0, len(environmentVariables))
			for k := range environmentVariables {
				keys = append(keys, k)
			}
			return keys
		}()),
	)

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

	permissions, err := h.service.rbacSvc.GetUserStackPermissions(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, "Failed to get user permissions")
	}

	return common.SendSuccess(c, map[string]any{
		"permissions": permissions,
	})
}

func (h *APIHandler) GetComposeConfig(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	composeConfig, err := h.service.GetComposeConfig(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, composeConfig)
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

	var changes map[string]any
	if err := c.Bind(&changes); err != nil {
		return common.SendBadRequest(c, "invalid request body")
	}

	result, err := h.service.UpdateCompose(c.Request().Context(), userID, serverID, stackname, changes)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, result)
}
