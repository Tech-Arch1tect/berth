package vulnscan

import "berth/models"

type StartScanRequest struct {
	Services []string `json:"services,omitempty"`
}

type StartScanResponse struct {
	Success bool          `json:"success"`
	Data    StartScanData `json:"data"`
}

type StartScanData struct {
	Scan models.ImageScan `json:"scan"`
}

type GetScanResponse struct {
	Success bool        `json:"success"`
	Data    GetScanData `json:"data"`
}

type GetScanData struct {
	Scan models.ImageScan `json:"scan"`
}

type GetScansHistoryResponse struct {
	Success bool                `json:"success"`
	Data    GetScansHistoryData `json:"data"`
}

type GetScansHistoryData struct {
	Scans []ScanWithSummary `json:"scans"`
}

type GetLatestScanResponse struct {
	Success bool              `json:"success"`
	Data    GetLatestScanData `json:"data"`
}

type GetLatestScanData struct {
	Scan    models.ImageScan      `json:"scan"`
	Summary *VulnerabilitySummary `json:"summary"`
}

type GetScanSummaryResponse struct {
	Success bool               `json:"success"`
	Data    GetScanSummaryData `json:"data"`
}

type GetScanSummaryData struct {
	Summary VulnerabilitySummary `json:"summary"`
}

type CompareScanResponse struct {
	Success bool            `json:"success"`
	Data    CompareScanData `json:"data"`
}

type CompareScanData struct {
	Comparison ScanComparison `json:"comparison"`
}

type GetScanTrendResponse struct {
	Success bool             `json:"success"`
	Data    GetScanTrendData `json:"data"`
}

type GetScanTrendData struct {
	StackTrend    []ScanTrendPoint `json:"stack_trend"`
	PerImageTrend []PerImageTrend  `json:"per_image_trend"`
	ScopeWarning  string           `json:"scope_warning,omitempty"`
}
