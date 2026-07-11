package backups

import (
	"errors"

	"berth/internal/domain/authz"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

	"github.com/labstack/echo/v4"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{service: service}
}

func (h *APIHandler) ListBackups(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	result, err := h.service.ListBackups(c.Request().Context(), p, serverID, stackname)
	if err != nil {
		return response.Internal(c, err.Error())
	}
	return response.OK(c, *result)
}

func (h *APIHandler) GetBackup(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	backupID := c.Param("backupid")
	if backupID == "" {
		return response.BadRequest(c, "backup id is required")
	}

	result, err := h.service.GetBackup(c.Request().Context(), p, serverID, stackname, backupID)
	if err != nil {
		if errors.Is(err, ErrBackupNotFound) {
			return response.NotFound(c, "backup not found")
		}
		return response.Internal(c, err.Error())
	}
	return response.OK(c, *result)
}
