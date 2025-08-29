package files

import (
	"brx-starter-kit/internal/common"

	"github.com/labstack/echo/v4"
)

type WebAPIHandler struct {
	service *Service
}

func NewWebAPIHandler(service *Service) *WebAPIHandler {
	return &WebAPIHandler{
		service: service,
	}
}

func (h *WebAPIHandler) ListDirectory(c echo.Context) error {
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

func (h *WebAPIHandler) ReadFile(c echo.Context) error {
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

func (h *WebAPIHandler) WriteFile(c echo.Context) error {
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

func (h *WebAPIHandler) CreateDirectory(c echo.Context) error {
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

func (h *WebAPIHandler) Delete(c echo.Context) error {
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

func (h *WebAPIHandler) Rename(c echo.Context) error {
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

func (h *WebAPIHandler) Copy(c echo.Context) error {
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

func (h *WebAPIHandler) UploadFile(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	path := common.GetQueryParam(c, "path")

	file, err := c.FormFile("file")
	if err != nil {
		return common.SendBadRequest(c, "file is required")
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackname, path, file); err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendMessage(c, "File uploaded successfully")
}

func (h *WebAPIHandler) DownloadFile(c echo.Context) error {
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
