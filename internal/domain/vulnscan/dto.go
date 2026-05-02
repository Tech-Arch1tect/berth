package vulnscan

type StartScanRequest struct {
	Services []string `json:"services,omitempty"`
}

type StartScanData struct {
	Scan ImageScan `json:"scan"`
}

type GetScanData struct {
	Scan ImageScan `json:"scan"`
}

type GetScansHistoryData struct {
	Scans []ScanWithSummary `json:"scans"`
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
