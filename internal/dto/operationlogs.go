package dto

import "berth/models"

type OperationLogResponse struct {
	models.OperationLog
	UserName        string  `json:"user_name"`
	ServerName      string  `json:"server_name"`
	WebhookName     *string `json:"webhook_name,omitempty"`
	TriggerSource   string  `json:"trigger_source"`
	IsIncomplete    bool    `json:"is_incomplete"`
	FormattedDate   string  `json:"formatted_date"`
	MessageCount    int64   `json:"message_count"`
	PartialDuration *int    `json:"partial_duration_ms"`
}

type OperationLogDetail struct {
	Log      OperationLogResponse         `json:"log"`
	Messages []models.OperationLogMessage `json:"messages"`
}

type OperationLogStats struct {
	TotalOperations      int64 `json:"total_operations"`
	IncompleteOperations int64 `json:"incomplete_operations"`
	FailedOperations     int64 `json:"failed_operations"`
	SuccessfulOperations int64 `json:"successful_operations"`
	RecentOperations     int64 `json:"recent_operations"`
}

type PaginationInfo struct {
	CurrentPage int   `json:"current_page"`
	PageSize    int   `json:"page_size"`
	Total       int64 `json:"total"`
	TotalPages  int   `json:"total_pages"`
	HasNext     bool  `json:"has_next"`
	HasPrev     bool  `json:"has_prev"`
}

type PaginatedOperationLogs struct {
	Data       []OperationLogResponse `json:"data"`
	Pagination PaginationInfo         `json:"pagination"`
}
