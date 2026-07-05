package vulnscan

import (
	"errors"
	"slices"
)

var ErrStartScanEmptyService = errors.New("services entries must be non-empty")

type StartScanRequest struct {
	Services []string `json:"services,omitempty"`
}

func (r *StartScanRequest) Validate() error {
	if slices.Contains(r.Services, "") {
		return ErrStartScanEmptyService
	}
	return nil
}

type StartScanData struct {
	Scan ImageScan `json:"scan"`
}

type GetScanData struct {
	Scan ImageScan `json:"scan"`
}

type GetScansHistoryData struct {
	Scans    []ScanWithSummary `json:"scans"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

type GetLatestScanData struct {
	Scan    ImageScan             `json:"scan"`
	Summary *VulnerabilitySummary `json:"summary"`
}

type GetScanSummaryData struct {
	Summary VulnerabilitySummary `json:"summary"`
}

type CompareScanData struct {
	Comparison ScanComparison `json:"comparison"`
}

type GetScanTrendData struct {
	StackTrend    []ScanTrendPoint `json:"stack_trend"`
	PerImageTrend []PerImageTrend  `json:"per_image_trend"`
	ScopeWarning  string           `json:"scope_warning,omitempty"`
}
