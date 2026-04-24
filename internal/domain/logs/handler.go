package logs

import (
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"strconv"
	"strings"

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
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	req := LogRequest{
		UserID:     userID,
		ServerID:   serverID,
		StackName:  stackname,
		Tail:       h.parseIntParam(c, "tail", 100),
		Since:      echoparams.GetQueryParam(c, "since"),
		Timestamps: h.parseBoolParam(c, "timestamps", true),
	}

	logsData, err := h.service.GetStackLogs(c.Request().Context(), req)
	if err != nil {
		if strings.Contains(err.Error(), "insufficient permissions") {
			return response.SendForbidden(c, err.Error())
		}
		if strings.Contains(err.Error(), "record not found") {
			return response.SendNotFound(c, "Server not found")
		}
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, LogsResponse{
		Success: true,
		Data:    *logsData,
	})
}

func (h *Handler) GetContainerLogs(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	containerName := c.Param("containerName")
	if containerName == "" {
		return response.SendBadRequest(c, "Container name is required")
	}

	req := LogRequest{
		UserID:        userID,
		ServerID:      serverID,
		StackName:     stackname,
		ContainerName: containerName,
		Tail:          h.parseIntParam(c, "tail", 100),
		Since:         echoparams.GetQueryParam(c, "since"),
		Timestamps:    h.parseBoolParam(c, "timestamps", true),
	}

	logsData, err := h.service.GetContainerLogs(c.Request().Context(), req)
	if err != nil {
		if strings.Contains(err.Error(), "insufficient permissions") {
			return response.SendForbidden(c, err.Error())
		}
		if strings.Contains(err.Error(), "record not found") {
			return response.SendNotFound(c, "Server not found")
		}
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, LogsResponse{
		Success: true,
		Data:    *logsData,
	})
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
