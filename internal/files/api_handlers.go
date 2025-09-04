package files

import (
	"berth/internal/common"

	"github.com/labstack/echo/v4"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{
		service: service,
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

	path := common.GetQueryParam(c, "path")

	result, err := h.service.ListDirectory(c.Request().Context(), userID, serverID, stackname, path)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, result)
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

	path := common.GetQueryParam(c, "path")
	if path == "" {
		return common.SendBadRequest(c, "path parameter is required")
	}

	result, err := h.service.ReadFile(c.Request().Context(), userID, serverID, stackname, path)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, result)
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

	return common.SendMessage(c, "success")
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

	return common.SendMessage(c, "success")
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

	return common.SendMessage(c, "success")
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

	return common.SendMessage(c, "success")
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

	return common.SendMessage(c, "success")
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

	path := c.FormValue("path")

	file, err := c.FormFile("file")
	if err != nil {
		return common.SendBadRequest(c, "file is required")
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackname, path, file); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendMessage(c, "File uploaded successfully")
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

	path := common.GetQueryParam(c, "path")
	if path == "" {
		return common.SendBadRequest(c, "path parameter is required")
	}

	filename := common.GetQueryParam(c, "filename")

	result, err := h.service.DownloadFile(c.Request().Context(), userID, serverID, stackname, path, filename)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}
	defer result.Body.Close()

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

	return common.SendMessage(c, "success")
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

	return common.SendMessage(c, "success")
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

	path := c.QueryParam("path")
	if path == "" {
		path = "."
	}

	stats, err := h.service.GetDirectoryStats(c.Request().Context(), userID, serverID, stackname, path)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, stats)
}
