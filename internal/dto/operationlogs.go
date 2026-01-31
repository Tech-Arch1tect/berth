package dto

import "berth/models"

type OperationLogInfo struct {
	models.OperationLog
	UserName        string `json:"user_name"`
	ServerName      string `json:"server_name"`
	TriggerSource   string `json:"trigger_source"`
	IsIncomplete    bool   `json:"is_incomplete"`
	FormattedDate   string `json:"formatted_date"`
	MessageCount    int64  `json:"message_count"`
	PartialDuration *int   `json:"partial_duration_ms,omitempty"`
}

type OperationLogDetailData struct {
	Log      OperationLogInfo             `json:"log"`
	Messages []models.OperationLogMessage `json:"messages"`
}

type OperationLogDetailResponse struct {
	Success bool                   `json:"success"`
	Data    OperationLogDetailData `json:"data"`
}

type OperationLogStatsData struct {
	TotalOperations      int64 `json:"total_operations"`
	IncompleteOperations int64 `json:"incomplete_operations"`
	FailedOperations     int64 `json:"failed_operations"`
	SuccessfulOperations int64 `json:"successful_operations"`
	RecentOperations     int64 `json:"recent_operations"`
}

type OperationLogStatsResponse struct {
	Success bool                  `json:"success"`
	Data    OperationLogStatsData `json:"data"`
}

type PaginationInfo struct {
	CurrentPage int   `json:"current_page"`
	PageSize    int   `json:"page_size"`
	Total       int64 `json:"total"`
	TotalPages  int   `json:"total_pages"`
	HasNext     bool  `json:"has_next"`
	HasPrev     bool  `json:"has_prev"`
}

type PaginatedOperationLogsData struct {
	Data       []OperationLogInfo `json:"data"`
	Pagination PaginationInfo     `json:"pagination"`
}

type PaginatedOperationLogsResponse struct {
	Success bool                       `json:"success"`
	Data    PaginatedOperationLogsData `json:"data"`
}

type RunningOperationsData struct {
	Operations []OperationLogInfo `json:"operations"`
}

type RunningOperationsResponse struct {
	Success bool                  `json:"success"`
	Data    RunningOperationsData `json:"data"`
}
