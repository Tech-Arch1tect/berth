package vulnscan

import (
	"berth/internal/domain/authz"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"strconv"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type Handler struct {
	service *Service
	logger  *zap.Logger
}

func NewHandler(service *Service, logger *zap.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

func (h *Handler) StartScan(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req StartScanRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}
	var opts *StartScanOptions
	if len(req.Services) > 0 {
		opts = &StartScanOptions{Services: req.Services}
	}

	h.logger.Debug("starting vulnerability scan",
		zap.Uint("user_id", p.UserID()),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
	)

	scan, err := h.service.StartScan(c.Request().Context(), p, serverID, stackName, opts)
	if err != nil {
		h.logger.Error("failed to start scan",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return response.Internal(c, err.Error())
	}

	return response.OK(c, StartScanData{Scan: *scan})
}

func (h *Handler) GetScan(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	scanID, err := echoparams.ParseUintParam(c, "scanid")
	if err != nil {
		return err
	}

	scan, err := h.service.GetScan(c.Request().Context(), p, scanID)
	if err != nil {
		return response.NotFound(c, "scan not found")
	}

	return response.OK(c, GetScanData{Scan: *scan})
}

func (h *Handler) GetScansForStack(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	scans, err := h.service.GetScansForStackWithSummaries(c.Request().Context(), p, serverID, stackName)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, GetScansHistoryData{Scans: scans})
}

func (h *Handler) GetLatestScanForStack(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	scan, err := h.service.GetLatestScanForStack(c.Request().Context(), p, serverID, stackName)
	if err != nil {
		return response.NotFound(c, "no scans found for stack")
	}

	summary, err := h.service.GetVulnerabilitySummary(scan.ID)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, GetLatestScanData{
		Scan:    *scan,
		Summary: summary,
	})
}

func (h *Handler) GetScanSummary(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	scanID, err := echoparams.ParseUintParam(c, "scanid")
	if err != nil {
		return err
	}

	_, err = h.service.GetScan(c.Request().Context(), p, scanID)
	if err != nil {
		return response.NotFound(c, "scan not found")
	}

	summary, err := h.service.GetVulnerabilitySummary(scanID)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	return response.OK(c, GetScanSummaryData{Summary: *summary})
}

func (h *Handler) CompareScans(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	baseScanID, err := echoparams.ParseUintParam(c, "baseScanId")
	if err != nil {
		return response.BadRequest(c, "invalid base scan ID")
	}

	compareScanID, err := echoparams.ParseUintParam(c, "compareScanId")
	if err != nil {
		return response.BadRequest(c, "invalid compare scan ID")
	}

	comparison, err := h.service.CompareScans(c.Request().Context(), p, baseScanID, compareScanID)
	if err != nil {
		h.logger.Error("failed to compare scans",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.Uint("base_scan_id", baseScanID),
			zap.Uint("compare_scan_id", compareScanID),
		)
		return response.Internal(c, err.Error())
	}

	return response.OK(c, CompareScanData{Comparison: *comparison})
}

func (h *Handler) GetScanTrend(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, stackName, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	limit := 10
	if limitStr := c.QueryParam("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	trend, err := h.service.GetScanTrend(c.Request().Context(), p, serverID, stackName, limit)
	if err != nil {
		h.logger.Error("failed to get scan trend",
			zap.Error(err),
			zap.Uint("user_id", p.UserID()),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return response.Internal(c, err.Error())
	}

	return response.OK(c, GetScanTrendData{
		StackTrend:    trend.StackTrend,
		PerImageTrend: trend.PerImageTrend,
		ScopeWarning:  trend.ScopeWarning,
	})
}
