package files

import (
	"berth/internal/domain/security"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"berth/internal/domain/session"

	"github.com/labstack/echo/v4"
)

type fileAuditLogger interface {
	LogFileEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName, filePath, ip string, metadata map[string]any) error
}

type APIHandler struct {
	service  *Service
	auditSvc fileAuditLogger
}

func NewAPIHandler(service *Service, auditSvc fileAuditLogger) *APIHandler {
	return &APIHandler{
		service:  service,
		auditSvc: auditSvc,
	}
}

func (h *APIHandler) ListDirectory(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := echoparams.GetQueryParam(c, "filePath")

	result, err := h.service.ListDirectory(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, *result)
}

func (h *APIHandler) ReadFile(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := echoparams.GetQueryParam(c, "filePath")
	if filePath == "" {
		return response.BadRequest(c, "filePath parameter is required")
	}

	result, err := h.service.ReadFile(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, *result)
}

func (h *APIHandler) WriteFile(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req WriteFileRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.WriteFile(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	_ = h.auditSvc.LogFileEvent(
		security.EventFileUploaded,
		userID,
		session.ResolveUsername(c),
		serverID,
		stackname,
		req.Path,
		c.RealIP(),
		nil,
	)

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) CreateDirectory(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req CreateDirectoryRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.CreateDirectory(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) Delete(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req DeleteRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.Delete(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	_ = h.auditSvc.LogFileEvent(
		security.EventFileDeleted,
		userID,
		session.ResolveUsername(c),
		serverID,
		stackname,
		req.Path,
		c.RealIP(),
		nil,
	)

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) Rename(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req RenameRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.Rename(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	_ = h.auditSvc.LogFileEvent(
		security.EventFileRenamed,
		userID,
		session.ResolveUsername(c),
		serverID,
		stackname,
		req.NewPath,
		c.RealIP(),
		map[string]any{
			"old_path": req.OldPath,
		},
	)

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) Copy(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req CopyRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.Copy(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) UploadFile(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := c.FormValue("filePath")

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "file is required")
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackname, filePath, file); err != nil {
		return response.Internal(c, err.Error())
	}

	_ = h.auditSvc.LogFileEvent(
		security.EventFileUploaded,
		userID,
		session.ResolveUsername(c),
		serverID,
		stackname,
		filePath,
		c.RealIP(),
		map[string]any{
			"filename": file.Filename,
			"size":     file.Size,
		},
	)

	return response.OK(c, FileMessageData{Message: "File uploaded successfully"})
}

func (h *APIHandler) DownloadFile(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := echoparams.GetQueryParam(c, "filePath")
	if filePath == "" {
		return response.BadRequest(c, "filePath parameter is required")
	}

	filename := echoparams.GetQueryParam(c, "filename")

	result, err := h.service.DownloadFile(c.Request().Context(), userID, serverID, stackname, filePath, filename)
	if err != nil {
		return response.Internal(c, err.Error())
	}
	defer result.Body.Close()

	_ = h.auditSvc.LogFileEvent(
		security.EventFileDownloaded,
		userID,
		session.ResolveUsername(c),
		serverID,
		stackname,
		filePath,
		c.RealIP(),
		map[string]any{
			"filename": filename,
		},
	)

	c.Response().Header().Set("Content-Type", "application/octet-stream")
	if filename != "" {
		c.Response().Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	}

	return c.Stream(200, "application/octet-stream", result.Body)
}

func (h *APIHandler) Chmod(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req ChmodRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.Chmod(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) Chown(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req ChownRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.service.Chown(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, FileMessageData{Message: "success"})
}

func (h *APIHandler) GetDirectoryStats(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := c.QueryParam("filePath")
	if filePath == "" {
		filePath = "."
	}

	stats, err := h.service.GetDirectoryStats(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, *stats)
}
