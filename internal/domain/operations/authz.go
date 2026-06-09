package operations

import (
	"encoding/json"
	"net/http"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/echoparams"

	"github.com/labstack/echo/v4"
)

func permissionForCommand(command string) string {
	if command == "create-archive" || command == "extract-archive" {
		return permnames.FilesWrite
	}
	return permnames.StacksManage
}

func operationRequirement(c echo.Context) ([]authz.Requirement, error) {
	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return nil, err
	}

	var req OperationRequest
	if err := json.NewDecoder(c.Request().Body).Decode(&req); err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	return []authz.Requirement{{
		Kind:       authz.KindStack,
		Permission: permissionForCommand(req.Command),
		ServerID:   serverID,
		Stack:      stackname,
	}}, nil
}

func (h *StreamHandler) streamRequirement(c echo.Context) ([]authz.Requirement, error) {
	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return nil, err
	}
	operationID := c.Param("operationId")
	if operationID == "" {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "operationId is required")
	}

	perm := permnames.StacksManage
	if log, err := h.service.auditSvc.FindOperationLogByOperationID(operationID); err == nil &&
		log.ServerID == serverID && log.StackName == stackname {
		perm = permissionForCommand(log.Command)
	}

	return []authz.Requirement{{
		Kind:       authz.KindStack,
		Permission: perm,
		ServerID:   serverID,
		Stack:      stackname,
	}}, nil
}
