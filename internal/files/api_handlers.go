package files

import (
	"berth/internal/common"
	"berth/internal/security"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type APIHandler struct {
	db       *gorm.DB
	service  *Service
	auditSvc *security.AuditService
}

func NewAPIHandler(db *gorm.DB, service *Service, auditSvc *security.AuditService) *APIHandler {
	return &APIHandler{
		db:       db,
		service:  service,
		auditSvc: auditSvc,
	}
}

func (h *APIHandler) ListDirectory(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := common.GetQueryParam(c, "filePath")

	result, err := h.service.ListDirectory(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, DirectoryListing(*result))
}

func (h *APIHandler) ReadFile(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := common.GetQueryParam(c, "filePath")
	if filePath == "" {
		return common.SendBadRequest(c, "filePath parameter is required")
	}

	result, err := h.service.ReadFile(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, FileContent(*result))
}

func (h *APIHandler) WriteFile(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req WriteFileRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return common.SendBadRequest(c, "path is required")
	}

	if err := h.service.WriteFile(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
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

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) CreateDirectory(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req CreateDirectoryRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return common.SendBadRequest(c, "path is required")
	}

	if err := h.service.CreateDirectory(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) Delete(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req DeleteRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return common.SendBadRequest(c, "path is required")
	}

	if err := h.service.Delete(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
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

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) Rename(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req RenameRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.OldPath == "" || req.NewPath == "" {
		return common.SendBadRequest(c, "oldPath and newPath are required")
	}

	if err := h.service.Rename(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
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

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) Copy(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req CopyRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.SourcePath == "" || req.TargetPath == "" {
		return common.SendBadRequest(c, "sourcePath and targetPath are required")
	}

	if err := h.service.Copy(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) UploadFile(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := c.FormValue("filePath")

	file, err := c.FormFile("file")
	if err != nil {
		return common.SendBadRequest(c, "file is required")
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackname, filePath, file); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
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

	return common.SendSuccess(c, MessageResponse{Message: "File uploaded successfully"})
}

func (h *APIHandler) DownloadFile(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := common.GetQueryParam(c, "filePath")
	if filePath == "" {
		return common.SendBadRequest(c, "filePath parameter is required")
	}

	filename := common.GetQueryParam(c, "filename")

	result, err := h.service.DownloadFile(c.Request().Context(), userID, serverID, stackname, filePath, filename)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}
	defer result.Body.Close()

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
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
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req ChmodRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return common.SendBadRequest(c, "path is required")
	}

	if req.Mode == "" {
		return common.SendBadRequest(c, "mode is required")
	}

	if err := h.service.Chmod(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) Chown(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req ChownRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Path == "" {
		return common.SendBadRequest(c, "path is required")
	}

	if req.OwnerID == nil && req.GroupID == nil {
		return common.SendBadRequest(c, "owner_id or group_id is required")
	}

	if err := h.service.Chown(c.Request().Context(), userID, serverID, stackname, req); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, MessageResponse{Message: "success"})
}

func (h *APIHandler) GetDirectoryStats(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	filePath := c.QueryParam("filePath")
	if filePath == "" {
		filePath = "."
	}

	stats, err := h.service.GetDirectoryStats(c.Request().Context(), userID, serverID, stackname, filePath)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, DirectoryStats(*stats))
}
