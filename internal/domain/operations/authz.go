package operations

import (
	"encoding/json"
	"net/http"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/echoparams"

	"github.com/labstack/echo/v4"
)

func operationRequirement(c echo.Context) ([]authz.Requirement, error) {
	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return nil, err
	}

	var req OperationRequest
	if err := json.NewDecoder(c.Request().Body).Decode(&req); err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var perm string
	if req.Command == "create-archive" || req.Command == "extract-archive" {
		perm = permnames.FilesWrite
	} else {
		perm = permnames.StacksManage
	}

	return []authz.Requirement{{
		Kind:       authz.KindStack,
		Permission: perm,
		ServerID:   serverID,
		Stack:      stackname,
	}}, nil
}
