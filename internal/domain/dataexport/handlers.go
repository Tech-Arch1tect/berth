package dataexport

import (
	"berth/internal/domain/rbac"
	"berth/internal/domain/session"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type Handler struct {
	logger  *zap.Logger
	service *Service
	rbacSvc *rbac.Service
}

func NewHandler(logger *zap.Logger, service *Service, rbacSvc *rbac.Service) *Handler {
	return &Handler{
		logger:  logger,
		service: service,
		rbacSvc: rbacSvc,
	}
}

func (h *Handler) Export(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	isAdmin, err := h.rbacSvc.HasRole(userID, rbac.RoleAdmin)
	if err != nil || !isAdmin {
		h.logger.Warn("unauthorized export attempt",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
	}

	var request ExportRequest
	if err := validation.BindAndValidate(c, &request); err != nil {
		h.logger.Warn("export request rejected",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return err
	}
	password := request.Password

	h.logger.Info("starting data export",
		zap.Uint("user_id", userID),
	)

	encryptedData, err := h.service.ExportData(password)
	if err != nil {
		h.logger.Error("failed to export data",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusInternalServerError, "Export failed")
	}

	filename := fmt.Sprintf("berth-backup-%d.json", time.Now().Unix())

	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Response().Header().Set("Content-Length", strconv.Itoa(len(encryptedData)))

	h.logger.Info("data export completed successfully",
		zap.Uint("user_id", userID),
		zap.String("filename", filename),
		zap.Int("file_size", len(encryptedData)),
	)

	return c.Blob(http.StatusOK, "application/octet-stream", encryptedData)
}

func (h *Handler) Import(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	isAdmin, err := h.rbacSvc.HasRole(userID, rbac.RoleAdmin)
	if err != nil || !isAdmin {
		h.logger.Warn("unauthorized import attempt",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
	}

	password := c.FormValue("password")
	if password == "" {
		h.logger.Warn("import attempted without password",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Password is required")
	}

	file, err := c.FormFile("backup_file")
	if err != nil {
		h.logger.Error("failed to get backup file from request",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Backup file is required")
	}

	src, err := file.Open()
	if err != nil {
		h.logger.Error("failed to open backup file",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to read backup file")
	}
	defer src.Close()

	encryptedData, err := io.ReadAll(src)
	if err != nil {
		h.logger.Error("failed to read backup file contents",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to read backup file")
	}

	h.logger.Info("starting data import",
		zap.Uint("user_id", userID),
		zap.String("filename", file.Filename),
		zap.Int("file_size", len(encryptedData)),
	)

	result, err := h.service.ImportData(encryptedData, password)
	if err != nil {
		h.logger.Error("failed to import data",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusInternalServerError, "Import failed: "+err.Error())
	}

	h.logger.Info("data import completed successfully",
		zap.Uint("user_id", userID),
		zap.Any("summary", result.Summary),
	)

	return response.OK(c, ImportData{
		EncryptionSecret: result.EncryptionSecret,
		Summary:          result.Summary,
	})
}
