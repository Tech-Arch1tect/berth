package security

import "time"

type SecurityAuditLogInfo struct {
	ID             uint      `json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	EventType      string    `json:"event_type"`
	EventCategory  string    `json:"event_category"`
	Severity       string    `json:"severity"`
	ActorUserID    *uint     `json:"actor_user_id"`
	ActorUsername  string    `json:"actor_username"`
	ActorIP        string    `json:"actor_ip"`
	ActorUserAgent string    `json:"actor_user_agent"`
	TargetUserID   *uint     `json:"target_user_id"`
	TargetType     string    `json:"target_type"`
	TargetID       *uint     `json:"target_id"`
	TargetName     string    `json:"target_name"`
	Success        bool      `json:"success"`
	FailureReason  string    `json:"failure_reason"`
	Metadata       string    `json:"metadata"`
	ServerID       *uint     `json:"server_id"`
	StackName      string    `json:"stack_name"`
	SessionID      string    `json:"session_id"`
}

type ListLogsResponseData struct {
	Logs       []SecurityAuditLogInfo `json:"logs"`
	Total      int64                  `json:"total"`
	Page       int                    `json:"page"`
	PerPage    int                    `json:"per_page"`
	TotalPages int                    `json:"total_pages"`
}

type ListLogsAPIResponse struct {
	Success bool                 `json:"success"`
	Data    ListLogsResponseData `json:"data"`
}

type GetLogAPIResponse struct {
	Success bool                 `json:"success"`
	Data    SecurityAuditLogInfo `json:"data"`
}

type EventTypeCount struct {
	EventType string `json:"event_type"`
	Count     int64  `json:"count"`
}

type StatsResponseData struct {
	TotalEvents       int64            `json:"total_events"`
	EventsByCategory  map[string]int64 `json:"events_by_category"`
	EventsBySeverity  map[string]int64 `json:"events_by_severity"`
	FailedEvents      int64            `json:"failed_events"`
	RecentEventTypes  []EventTypeCount `json:"recent_event_types"`
	EventsLast24Hours int64            `json:"events_last_24_hours"`
	EventsLast7Days   int64            `json:"events_last_7_days"`
}

type GetStatsAPIResponse struct {
	Success bool              `json:"success"`
	Data    StatsResponseData `json:"data"`
}
