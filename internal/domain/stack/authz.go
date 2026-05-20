package stack

import (
	"encoding/json"
	"net/http"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/echoparams"

	"github.com/labstack/echo/v4"
)

func createStackRequirement(c echo.Context) ([]authz.Requirement, error) {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return nil, err
	}

	var req CreateStackRequest
	if err := json.NewDecoder(c.Request().Body).Decode(&req); err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Name == "" {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	return []authz.Requirement{{
		Kind:       authz.KindStack,
		Permission: permnames.StacksCreate,
		ServerID:   serverID,
		Stack:      req.Name,
	}}, nil
}
