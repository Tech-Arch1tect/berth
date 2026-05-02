package operationlogs

type OperationLogInfo struct {
	OperationLog
	UserName        string `json:"user_name"`
	ServerName      string `json:"server_name"`
	TriggerSource   string `json:"trigger_source"`
	IsIncomplete    bool   `json:"is_incomplete"`
	FormattedDate   string `json:"formatted_date"`
	MessageCount    int64  `json:"message_count"`
	PartialDuration *int   `json:"partial_duration_ms,omitempty"`
}

type OperationLogDetailData struct {
	Log      OperationLogInfo      `json:"log"`
	Messages []OperationLogMessage `json:"messages"`
}

type OperationLogStatsData struct {
	TotalOperations      int64 `json:"total_operations"`
	IncompleteOperations int64 `json:"incomplete_operations"`
	FailedOperations     int64 `json:"failed_operations"`
	SuccessfulOperations int64 `json:"successful_operations"`
	RecentOperations     int64 `json:"recent_operations"`
}

type RunningOperationsData struct {
	Operations []OperationLogInfo `json:"operations"`
}
