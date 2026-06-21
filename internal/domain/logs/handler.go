package logs

import (
	"berth/internal/domain/authz"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
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
	principal, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	req := LogRequest{
		Principal:  principal,
		ServerID:   serverID,
		StackName:  stackname,
		Tail:       h.parseIntParam(c, "tail", 100),
		Since:      echoparams.GetQueryParam(c, "since"),
		Timestamps: h.parseBoolParam(c, "timestamps", true),
	}

	logsData, err := h.service.GetStackLogs(c.Request().Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInsufficientPermissions):
			return response.Forbidden(c, "Insufficient permissions")
		case errors.Is(err, gorm.ErrRecordNotFound):
			return response.NotFound(c, "Server not found")
		default:
			return response.Internal(c, "Internal server error")
		}
	}

	return response.OK(c, *logsData)
}

func (h *Handler) GetContainerLogs(c echo.Context) error {
	principal, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	containerName := c.Param("containerName")
	if containerName == "" {
		return response.BadRequest(c, "Container name is required")
	}

	req := LogRequest{
		Principal:     principal,
		ServerID:      serverID,
		StackName:     stackname,
		ContainerName: containerName,
		Tail:          h.parseIntParam(c, "tail", 100),
		Since:         echoparams.GetQueryParam(c, "since"),
		Timestamps:    h.parseBoolParam(c, "timestamps", true),
	}

	logsData, err := h.service.GetContainerLogs(c.Request().Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInsufficientPermissions):
			return response.Forbidden(c, "Insufficient permissions")
		case errors.Is(err, gorm.ErrRecordNotFound):
			return response.NotFound(c, "Server not found")
		default:
			return response.Internal(c, "Internal server error")
		}
	}

	return response.OK(c, *logsData)
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
