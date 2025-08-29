package stack

import (
	"brx-starter-kit/internal/common"

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
