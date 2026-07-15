package backups

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"berth/internal/domain/authz"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

	"github.com/labstack/echo/v4"
)

type backupSecurityAuditor interface {
	LogBackupEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName string, backupID string, ip string, metadata map[string]any) error
}

type APIHandler struct {
	service     *Service
	securityLog backupSecurityAuditor
}

func NewAPIHandler(service *Service, securityLog backupSecurityAuditor) *APIHandler {
	return &APIHandler{service: service, securityLog: securityLog}
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

	limit, offset := listPagination(c)
	result, err := h.service.ListBackups(c.Request().Context(), p, serverID, stackname, limit, offset)
	if err != nil {
		return response.Internal(c, err.Error())
	}
	return response.OK(c, *result)
}

func listPagination(c echo.Context) (limit, offset int) {
	limit = 20
	if raw := c.QueryParam("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 1 {
			limit = min(parsed, 100)
		}
	}
	if raw := c.QueryParam("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return limit, offset
}

func (h *APIHandler) DeleteBackup(c echo.Context) error {
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

	deleted, err := h.service.DeleteBackup(c.Request().Context(), p, serverID, stackname, backupID)
	if err != nil {
		if errors.Is(err, ErrBackupNotFound) {
			return response.NotFound(c, "backup not found")
		}
		if errors.Is(err, ErrRepositoryBusy) || errors.Is(err, ErrBackupsNotEnabled) {
			return response.Conflict(c, err.Error())
		}
		return response.Internal(c, err.Error())
	}
	metadata := map[string]any{"stack": stackname, "server_id": serverID}
	if deleted != nil {
		var sizeBytes, addedBytes uint64
		for _, component := range deleted.Components {
			sizeBytes += component.BytesProcessed
			addedBytes += component.BytesAdded
		}
		metadata["backup_taken_at"] = deleted.StartedAt
		metadata["backup_status"] = deleted.Status
		metadata["component_count"] = len(deleted.Components)
		metadata["data_size_bytes"] = sizeBytes
		metadata["repo_growth_bytes"] = addedBytes
	}
	_ = h.securityLog.LogBackupEvent(
		security.EventBackupDeleted,
		p.UserID(),
		session.ResolveUsername(c),
		serverID,
		stackname,
		backupID,
		c.RealIP(),
		metadata,
	)

	return response.OK(c, DeleteResponse{Message: "backup deleted"})
}

func (h *APIHandler) browseParams(c echo.Context) (p authz.Principal, serverID uint, stackname, backupID, componentID string, err error) {
	p, err = authz.RequirePrincipal(c)
	if err != nil {
		return
	}
	serverID, stackname, err = echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return
	}
	backupID = c.Param("backupid")
	if backupID == "" {
		err = response.BadRequest(c, "backup id is required")
		return
	}
	componentID = c.QueryParam("component")
	if componentID == "" {
		err = response.BadRequest(c, "component id is required")
		return
	}
	return
}

func (h *APIHandler) browseError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrAccessDenied):
		return response.Forbidden(c, "access denied")
	case errors.Is(err, ErrBackupNotFound):
		return response.NotFound(c, "backup, component or path not found")
	case errors.Is(err, ErrRepositoryBusy), errors.Is(err, ErrBackupsNotEnabled):
		return response.Conflict(c, err.Error())
	default:
		return response.Internal(c, err.Error())
	}
}

func (h *APIHandler) ListBackupFiles(c echo.Context) error {
	p, serverID, stackname, backupID, componentID, err := h.browseParams(c)
	if err != nil {
		return err
	}

	listing, err := h.service.ListBackupFiles(c.Request().Context(), p, serverID, stackname, backupID, componentID, c.QueryParam("path"))
	if err != nil {
		return h.browseError(c, err)
	}
	return response.OK(c, *listing)
}

func (h *APIHandler) DownloadBackupFiles(c echo.Context) error {
	p, serverID, stackname, backupID, componentID, err := h.browseParams(c)
	if err != nil {
		return err
	}
	paths := c.QueryParams()["path"]
	if len(paths) == 0 {
		return response.BadRequest(c, "at least one path is required")
	}

	agentResp, err := h.service.DownloadBackupFiles(c.Request().Context(), p, serverID, stackname, backupID, componentID, paths)
	if err != nil {
		return h.browseError(c, err)
	}
	defer func() { _ = agentResp.Body.Close() }()

	_ = h.securityLog.LogBackupEvent(
		security.EventBackupFileDownloaded,
		p.UserID(),
		session.ResolveUsername(c),
		serverID,
		stackname,
		backupID,
		c.RealIP(),
		map[string]any{"stack": stackname, "server_id": serverID, "component": componentID, "paths": paths},
	)

	res := c.Response()
	for _, header := range []string{echo.HeaderContentType, echo.HeaderContentDisposition, echo.HeaderContentLength} {
		if value := agentResp.Header.Get(header); value != "" {
			res.Header().Set(header, value)
		}
	}
	res.WriteHeader(http.StatusOK)
	_, err = io.Copy(res.Writer, agentResp.Body)
	return err
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
