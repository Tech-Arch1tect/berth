package files

import (
	"io"
	"net/http"
	"strconv"

	"brx-starter-kit/models"
	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
)

type APIHandler struct {
	service *Service
}

func NewAPIHandler(service *Service) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

func (h *APIHandler) getCurrentUser(c echo.Context) (*models.User, error) {
	currentUser := jwtshared.GetCurrentUser(c)
	if currentUser == nil {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not authenticated",
		})
	}

	userModel, ok := currentUser.(models.User)
	if !ok {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

	return &userModel, nil
}

func (h *APIHandler) getServerID(c echo.Context) (uint, error) {
	serverIDStr := c.Param("serverid")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return 0, echo.NewHTTPError(http.StatusBadRequest, map[string]string{"error": "Invalid server ID"})
	}
	return uint(serverID), nil
}

func (h *APIHandler) getStackName(c echo.Context) (string, error) {
	stackName := c.Param("stackname")
	if stackName == "" {
		return "", echo.NewHTTPError(http.StatusBadRequest, map[string]string{"error": "Stack name is required"})
	}
	return stackName, nil
}

func (h *APIHandler) ListDirectory(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	result, err := h.service.ListDirectory(c.Request().Context(), user.ID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *APIHandler) ReadFile(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	result, err := h.service.ReadFile(c.Request().Context(), user.ID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *APIHandler) WriteFile(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	if err := h.service.WriteFile(c.Request().Context(), user.ID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *APIHandler) CreateDirectory(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	if err := h.service.CreateDirectory(c.Request().Context(), user.ID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *APIHandler) Delete(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	if err := h.service.Delete(c.Request().Context(), user.ID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *APIHandler) Rename(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	if err := h.service.Rename(c.Request().Context(), user.ID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *APIHandler) Copy(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	if err := h.service.Copy(c.Request().Context(), user.ID, serverID, stackName, req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}

func (h *APIHandler) GetFileInfo(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	result, err := h.service.GetFileInfo(c.Request().Context(), user.ID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *APIHandler) GetChecksum(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	checksum, err := h.service.GetChecksum(c.Request().Context(), user.ID, serverID, stackName, path)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"path":     path,
		"checksum": checksum.Checksum,
		"type":     "md5",
	})
}

func (h *APIHandler) DownloadFile(c echo.Context) error {
	user, err := h.getCurrentUser(c)
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

	resp, err := h.service.DownloadFile(c.Request().Context(), user.ID, serverID, stackName, path, filename)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}
	defer func() { _ = resp.Body.Close() }()

	c.Response().Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	c.Response().Header().Set("Content-Disposition", resp.Header.Get("Content-Disposition"))
	if contentLength := resp.Header.Get("Content-Length"); contentLength != "" {
		c.Response().Header().Set("Content-Length", contentLength)
	}

	c.Response().WriteHeader(resp.StatusCode)
	_, err = io.Copy(c.Response().Writer, resp.Body)
	return err
}
