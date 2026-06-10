package operations

import (
	"berth/internal/domain/authz"
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
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	stackname := c.Param("stackname")
	if stackname == "" {
		return response.BadRequest(c, "Stack name is required")
	}

	var req OperationRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	resp, err := h.service.StartOperation(c.Request().Context(), p, serverID, stackname, req)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	startTime := time.Now()
	h.service.auditSvc.LogOperationStart(p.UserID(), serverID, stackname, resp.OperationID, req, startTime)

	return response.OK(c, *resp)
}
