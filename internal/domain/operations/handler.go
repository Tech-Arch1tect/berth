package operations

import (
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"time"

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

func (h *Handler) StartOperation(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	stackname := c.Param("stackname")
	if stackname == "" {
		return response.SendBadRequest(c, "Stack name is required")
	}

	var req OperationRequest
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	resp, err := h.service.StartOperation(c.Request().Context(), userID, serverID, stackname, req)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	startTime := time.Now()
	h.service.auditSvc.LogOperationStart(userID, serverID, stackname, resp.OperationID, req, startTime)

	return response.SendSuccess(c, resp)
}
