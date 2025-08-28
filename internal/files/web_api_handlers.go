package files

import (
	"io"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/session"
)

type WebAPIHandler struct {
	service *Service
}

func NewWebAPIHandler(service *Service) *WebAPIHandler {
	return &WebAPIHandler{
		service: service,
	}
}

func (h *WebAPIHandler) getCurrentUserID(c echo.Context) (uint, error) {
	userID := session.GetUserID(c)
	if userID == 0 {
		return 0, echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	if id, ok := userID.(uint); ok {
		return id, nil
	}

	return 0, echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
		"error": "Invalid user ID type",
	})
}

func (h *WebAPIHandler) getServerID(c echo.Context) (uint, error) {
	serverID, err := strconv.ParseUint(c.Param("serverid"), 10, 32)
	if err != nil {
		return 0, echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid server ID",
		})
	}
	return uint(serverID), nil
}

func (h *WebAPIHandler) getStackName(c echo.Context) (string, error) {
	stackName := c.Param("stackname")
	if stackName == "" {
		return "", echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Stack name is required",
		})
	}
	return stackName, nil
}

func (h *WebAPIHandler) ListDirectory(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	path := c.QueryParam("path")

	result, err := h.service.ListDirectory(c.Request().Context(), userID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *WebAPIHandler) ReadFile(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path parameter is required",
		})
	}

	result, err := h.service.ReadFile(c.Request().Context(), userID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *WebAPIHandler) WriteFile(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	var req WriteFileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path is required",
		})
	}

	if err := h.service.WriteFile(c.Request().Context(), userID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) UploadFile(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	path := c.FormValue("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path parameter is required",
		})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "file parameter is required",
		})
	}

	if err := h.service.UploadFile(c.Request().Context(), userID, serverID, stackName, path, file); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) CreateDirectory(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	var req CreateDirectoryRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path is required",
		})
	}

	if err := h.service.CreateDirectory(c.Request().Context(), userID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) Delete(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	var req DeleteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path is required",
		})
	}

	if err := h.service.Delete(c.Request().Context(), userID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) Rename(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	var req RenameRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.OldPath == "" || req.NewPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "old_path and new_path are required",
		})
	}

	if err := h.service.Rename(c.Request().Context(), userID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) Copy(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	var req CopyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.SourcePath == "" || req.TargetPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "source_path and target_path are required",
		})
	}

	if err := h.service.Copy(c.Request().Context(), userID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *WebAPIHandler) DownloadFile(c echo.Context) error {
	userID, err := h.getCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := h.getServerID(c)
	if err != nil {
		return err
	}

	stackName, err := h.getStackName(c)
	if err != nil {
		return err
	}

	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "path parameter is required",
		})
	}

	filename := c.QueryParam("filename")

	resp, err := h.service.DownloadFile(c.Request().Context(), userID, serverID, stackName, path, filename)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}
	defer func() { _ = resp.Body.Close() }()

	c.Response().Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	c.Response().Header().Set("Content-Disposition", resp.Header.Get("Content-Disposition"))
	c.Response().Header().Set("Content-Length", resp.Header.Get("Content-Length"))

	c.Response().WriteHeader(resp.StatusCode)
	_, err = io.Copy(c.Response().Writer, resp.Body)
	return err
}
