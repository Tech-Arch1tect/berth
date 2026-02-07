package migration

import (
	"berth/internal/common"
	"berth/internal/rbac"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type Handler struct {
	inertiaSvc *inertia.Service
	logger     *logging.Service
	service    *Service
	rbacSvc    *rbac.Service
}

func NewHandler(inertiaSvc *inertia.Service, logger *logging.Service, service *Service, rbacSvc *rbac.Service) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		logger:     logger,
		service:    service,
		rbacSvc:    rbacSvc,
	}
}

func (h *Handler) Index(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	isAdmin, err := h.rbacSvc.HasRole(userID, rbac.RoleAdmin)
	if err != nil || !isAdmin {
		h.logger.Warn("unauthorized migration page access attempt",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
	}

	h.logger.Info("migration page accessed",
		zap.Uint("user_id", userID),
	)

	return h.inertiaSvc.Render(c, "Admin/Migration", gonertia.Props{
		"title": "Data Migration",
	})
}

func (h *Handler) Export(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
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
	if err := c.Bind(&request); err != nil {
		h.logger.Warn("failed to parse export request",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	password := request.Password
	if password == "" {
		h.logger.Warn("export attempted without password",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Password is required")
	}

	if len(password) < 12 {
		h.logger.Warn("export attempted with weak password",
			zap.Uint("user_id", userID),
		)
		return echo.NewHTTPError(http.StatusBadRequest, "Password must be at least 12 characters long")
	}

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
	userID, err := common.GetCurrentUserID(c)
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

	return c.JSON(http.StatusOK, ImportResponse{
		Success: true,
		Data: ImportResponseData{
			EncryptionSecret: result.EncryptionSecret,
			Summary:          result.Summary,
		},
	})
}
