package files

import (
	"berth/internal/domain/security"
	"berth/internal/domain/user"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"berth/internal/domain/session"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type fileAuditLogger interface {
	LogFileEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName, filePath, ip string, metadata map[string]any) error
}

type APIHandler struct {
	db       *gorm.DB
	service  *Service
	auditSvc fileAuditLogger
}

func NewAPIHandler(db *gorm.DB, service *Service, auditSvc fileAuditLogger) *APIHandler {
	return &APIHandler{
		db:       db,
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
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, DirectoryListingResponse{
		Success: true,
		Data:    *result,
	})
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
		return response.SendBadRequest(c, "filePath parameter is required")
	}

	result, err := h.service.ReadFile(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, FileContentResponse{
		Success: true,
		Data:    *result,
	})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return response.SendBadRequest(c, "path is required")
	}

	if err := h.service.WriteFile(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser user.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogFileEvent(
			security.EventFileUploaded,
			actorUser.ID,
			actorUser.Username,
			serverID,
			stackname,
			req.Path,
			c.RealIP(),
			nil,
		)
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return response.SendBadRequest(c, "path is required")
	}

	if err := h.service.CreateDirectory(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return response.SendBadRequest(c, "path is required")
	}

	if err := h.service.Delete(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser user.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogFileEvent(
			security.EventFileDeleted,
			actorUser.ID,
			actorUser.Username,
			serverID,
			stackname,
			req.Path,
			c.RealIP(),
			nil,
		)
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.OldPath == "" || req.NewPath == "" {
		return response.SendBadRequest(c, "oldPath and newPath are required")
	}

	if err := h.service.Rename(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser user.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogFileEvent(
			security.EventFileRenamed,
			actorUser.ID,
			actorUser.Username,
			serverID,
			stackname,
			req.NewPath,
			c.RealIP(),
			map[string]any{
				"old_path": req.OldPath,
			},
		)
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.SourcePath == "" || req.TargetPath == "" {
		return response.SendBadRequest(c, "sourcePath and targetPath are required")
	}

	if err := h.service.Copy(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
		return response.SendBadRequest(c, "file is required")
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackname, filePath, file); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser user.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogFileEvent(
			security.EventFileUploaded,
			actorUser.ID,
			actorUser.Username,
			serverID,
			stackname,
			filePath,
			c.RealIP(),
			map[string]any{
				"filename": file.Filename,
				"size":     file.Size,
			},
		)
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "File uploaded successfully"}})
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
		return response.SendBadRequest(c, "filePath parameter is required")
	}

	filename := echoparams.GetQueryParam(c, "filename")

	result, err := h.service.DownloadFile(c.Request().Context(), userID, serverID, stackname, filePath, filename)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}
	defer result.Body.Close()

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser user.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogFileEvent(
			security.EventFileDownloaded,
			actorUser.ID,
			actorUser.Username,
			serverID,
			stackname,
			filePath,
			c.RealIP(),
			map[string]any{
				"filename": filename,
			},
		)
	}

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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return response.SendBadRequest(c, "path is required")
	}

	if req.Mode == "" {
		return response.SendBadRequest(c, "mode is required")
	}

	if err := h.service.Chmod(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return response.SendBadRequest(c, "path is required")
	}

	if req.OwnerID == nil && req.GroupID == nil {
		return response.SendBadRequest(c, "owner_id or group_id is required")
	}

	if err := h.service.Chown(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, FileMessageResponse{Success: true, Data: FileMessageData{Message: "success"}})
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
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, DirectoryStatsResponse{
		Success: true,
		Data:    *stats,
	})
}
