package vulnscan

import (
	"berth/internal/common"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type Handler struct {
	service *Service
	logger  *logging.Service
}

func NewHandler(service *Service, logger *logging.Service) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

func (h *Handler) StartScan(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req StartScanRequest
	var opts *StartScanOptions
	if err := c.Bind(&req); err == nil && len(req.Services) > 0 {
		opts = &StartScanOptions{Services: req.Services}
	}

	h.logger.Debug("starting vulnerability scan",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
	)

	scan, err := h.service.StartScan(c.Request().Context(), userID, serverID, stackName, opts)
	if err != nil {
		h.logger.Error("failed to start scan",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, StartScanResponse{
		Success: true,
		Data:    StartScanData{Scan: *scan},
	})
}

func (h *Handler) GetScan(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	scanID, err := common.ParseUintParam(c, "scanid")
	if err != nil {
		return err
	}

	scan, err := h.service.GetScan(c.Request().Context(), userID, scanID)
	if err != nil {
		return common.SendNotFound(c, "scan not found")
	}

	return c.JSON(http.StatusOK, GetScanResponse{
		Success: true,
		Data:    GetScanData{Scan: *scan},
	})
}

func (h *Handler) GetScansForStack(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	scans, err := h.service.GetScansForStackWithSummaries(c.Request().Context(), userID, serverID, stackName)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, GetScansHistoryResponse{
		Success: true,
		Data:    GetScansHistoryData{Scans: scans},
	})
}

func (h *Handler) GetLatestScanForStack(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	scan, err := h.service.GetLatestScanForStack(c.Request().Context(), userID, serverID, stackName)
	if err != nil {
		return common.SendNotFound(c, "no scans found for stack")
	}

	summary, err := h.service.GetVulnerabilitySummary(scan.ID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, GetLatestScanResponse{
		Success: true,
		Data: GetLatestScanData{
			Scan:    *scan,
			Summary: summary,
		},
	})
}

func (h *Handler) GetScanSummary(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	scanID, err := common.ParseUintParam(c, "scanid")
	if err != nil {
		return err
	}

	_, err = h.service.GetScan(c.Request().Context(), userID, scanID)
	if err != nil {
		return common.SendNotFound(c, "scan not found")
	}

	summary, err := h.service.GetVulnerabilitySummary(scanID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, GetScanSummaryResponse{
		Success: true,
		Data:    GetScanSummaryData{Summary: *summary},
	})
}

func (h *Handler) CompareScans(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	baseScanID, err := common.ParseUintParam(c, "baseScanId")
	if err != nil {
		return common.SendBadRequest(c, "invalid base scan ID")
	}

	compareScanID, err := common.ParseUintParam(c, "compareScanId")
	if err != nil {
		return common.SendBadRequest(c, "invalid compare scan ID")
	}

	comparison, err := h.service.CompareScans(c.Request().Context(), userID, baseScanID, compareScanID)
	if err != nil {
		h.logger.Error("failed to compare scans",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("base_scan_id", baseScanID),
			zap.Uint("compare_scan_id", compareScanID),
		)
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, CompareScanResponse{
		Success: true,
		Data:    CompareScanData{Comparison: *comparison},
	})
}

func (h *Handler) GetScanTrend(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	limit := 10
	if limitStr := c.QueryParam("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	trend, err := h.service.GetScanTrend(c.Request().Context(), userID, serverID, stackName, limit)
	if err != nil {
		h.logger.Error("failed to get scan trend",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return common.SendInternalError(c, err.Error())
	}

	return c.JSON(http.StatusOK, GetScanTrendResponse{
		Success: true,
		Data: GetScanTrendData{
			StackTrend:    trend.StackTrend,
			PerImageTrend: trend.PerImageTrend,
			ScopeWarning:  trend.ScopeWarning,
		},
	})
}
