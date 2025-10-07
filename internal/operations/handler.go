package operations

import (
	"berth/internal/common"
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
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	stackname := c.Param("stackname")
	if stackname == "" {
		return common.SendBadRequest(c, "Stack name is required")
	}

	var req OperationRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	response, err := h.service.StartOperation(c.Request().Context(), userID, serverID, stackname, req)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	startTime := time.Now()
	h.service.auditSvc.LogOperationStart(userID, serverID, stackname, response.OperationID, req, startTime)

	return common.SendSuccess(c, response)
}
