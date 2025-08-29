package logs

import (
	"brx-starter-kit/internal/common"
	"strconv"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) GetStackLogs(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	req := LogRequest{
		UserID:     userID,
		ServerID:   serverID,
		StackName:  stackname,
		Tail:       h.parseIntParam(c, "tail", 100),
		Since:      common.GetQueryParam(c, "since"),
		Timestamps: h.parseBoolParam(c, "timestamps", true),
	}

	logs, err := h.service.GetStackLogs(c.Request().Context(), req)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, logs)
}

func (h *Handler) GetContainerLogs(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverId")
	if err != nil {
		return err
	}

	stackname := c.Param("stackname")
	containerName := c.Param("containerName")

	if stackname == "" || containerName == "" {
		return common.SendBadRequest(c, "Stack name and container name are required")
	}

	req := LogRequest{
		UserID:        userID,
		ServerID:      serverID,
		StackName:     stackname,
		ContainerName: containerName,
		Tail:          h.parseIntParam(c, "tail", 100),
		Since:         common.GetQueryParam(c, "since"),
		Timestamps:    h.parseBoolParam(c, "timestamps", true),
	}

	logs, err := h.service.GetContainerLogs(c.Request().Context(), req)
	if err != nil {
		c.Logger().Error("Container logs error: ", err)
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, logs)
}

func (h *Handler) parseIntParam(c echo.Context, param string, defaultValue int) int {
	if value := c.QueryParam(param); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultValue
}

func (h *Handler) parseBoolParam(c echo.Context, param string, defaultValue bool) bool {
	if value := c.QueryParam(param); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
