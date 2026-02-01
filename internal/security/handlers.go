package security

import (
	"berth/internal/common"
	"berth/models"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func toLogResponse(log *models.SecurityAuditLog) SecurityAuditLogInfo {
	return SecurityAuditLogInfo{
		ID:             log.ID,
		CreatedAt:      log.CreatedAt,
		UpdatedAt:      log.UpdatedAt,
		EventType:      log.EventType,
		EventCategory:  log.EventCategory,
		Severity:       log.Severity,
		ActorUserID:    log.ActorUserID,
		ActorUsername:  log.ActorUsername,
		ActorIP:        log.ActorIP,
		ActorUserAgent: log.ActorUserAgent,
		TargetUserID:   log.TargetUserID,
		TargetType:     log.TargetType,
		TargetID:       log.TargetID,
		TargetName:     log.TargetName,
		Success:        log.Success,
		FailureReason:  log.FailureReason,
		Metadata:       log.Metadata,
		ServerID:       log.ServerID,
		StackName:      log.StackName,
		SessionID:      log.SessionID,
	}
}

func toLogResponseList(logs []models.SecurityAuditLog) []SecurityAuditLogInfo {
	result := make([]SecurityAuditLogInfo, len(logs))
	for i, log := range logs {
		result[i] = toLogResponse(&log)
	}
	return result
}

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type ListLogsRequest struct {
	EventType     string `query:"event_type"`
	EventCategory string `query:"event_category"`
	Severity      string `query:"severity"`
	ActorUserID   string `query:"actor_user_id"`
	Success       string `query:"success"`
	StartDate     string `query:"start_date"`
	EndDate       string `query:"end_date"`
	Search        string `query:"search"`
	Page          int    `query:"page"`
	PerPage       int    `query:"per_page"`
}

func (h *Handler) ListLogs(c echo.Context) error {
	var req ListLogsRequest
	if err := c.Bind(&req); err != nil {
		return common.SendBadRequest(c, "Invalid request parameters")
	}

	if req.Page < 1 {
		req.Page = 1
	}
	if req.PerPage < 1 || req.PerPage > 100 {
		req.PerPage = 50
	}

	query := h.db.Model(&models.SecurityAuditLog{})

	if req.EventType != "" {
		query = query.Where("event_type = ?", req.EventType)
	}
	if req.EventCategory != "" {
		query = query.Where("event_category = ?", req.EventCategory)
	}
	if req.Severity != "" {
		query = query.Where("severity = ?", req.Severity)
	}
	if req.ActorUserID != "" {
		if actorID, err := strconv.ParseUint(req.ActorUserID, 10, 32); err == nil {
			query = query.Where("actor_user_id = ?", actorID)
		}
	}
	if req.Success != "" {
		if req.Success == "true" {
			query = query.Where("success = ?", true)
		} else if req.Success == "false" {
			query = query.Where("success = ?", false)
		}
	}
	if req.StartDate != "" {
		if startTime, err := time.Parse(time.RFC3339, req.StartDate); err == nil {
			query = query.Where("created_at >= ?", startTime)
		}
	}
	if req.EndDate != "" {
		if endTime, err := time.Parse(time.RFC3339, req.EndDate); err == nil {
			query = query.Where("created_at <= ?", endTime)
		}
	}
	if req.Search != "" {
		search := "%" + req.Search + "%"
		query = query.Where(
			"actor_username LIKE ? OR target_name LIKE ? OR event_type LIKE ?",
			search, search, search,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return common.SendInternalError(c, "Failed to count logs")
	}

	offset := (req.Page - 1) * req.PerPage
	var logs []models.SecurityAuditLog
	if err := query.Order("created_at DESC").Limit(req.PerPage).Offset(offset).Find(&logs).Error; err != nil {
		return common.SendInternalError(c, "Failed to fetch logs")
	}

	totalPages := int(total) / req.PerPage
	if int(total)%req.PerPage > 0 {
		totalPages++
	}

	return c.JSON(http.StatusOK, ListLogsAPIResponse{
		Success: true,
		Data: ListLogsResponseData{
			Logs:       toLogResponseList(logs),
			Total:      total,
			Page:       req.Page,
			PerPage:    req.PerPage,
			TotalPages: totalPages,
		},
	})
}

func (h *Handler) GetLog(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var log models.SecurityAuditLog
	if err := h.db.First(&log, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return common.SendNotFound(c, "Log not found")
		}
		return common.SendInternalError(c, "Failed to fetch log")
	}

	return c.JSON(http.StatusOK, GetLogAPIResponse{
		Success: true,
		Data:    toLogResponse(&log),
	})
}

func (h *Handler) GetStats(c echo.Context) error {
	var stats StatsResponseData

	h.db.Model(&models.SecurityAuditLog{}).Count(&stats.TotalEvents)

	h.db.Model(&models.SecurityAuditLog{}).Where("success = ?", false).Count(&stats.FailedEvents)

	now := time.Now()
	h.db.Model(&models.SecurityAuditLog{}).
		Where("created_at >= ?", now.Add(-24*time.Hour)).
		Count(&stats.EventsLast24Hours)

	h.db.Model(&models.SecurityAuditLog{}).
		Where("created_at >= ?", now.Add(-7*24*time.Hour)).
		Count(&stats.EventsLast7Days)

	stats.EventsByCategory = make(map[string]int64)
	var categoryRows []struct {
		EventCategory string
		Count         int64
	}
	h.db.Model(&models.SecurityAuditLog{}).
		Select("event_category, COUNT(*) as count").
		Group("event_category").
		Scan(&categoryRows)
	for _, row := range categoryRows {
		stats.EventsByCategory[row.EventCategory] = row.Count
	}

	stats.EventsBySeverity = make(map[string]int64)
	var severityRows []struct {
		Severity string
		Count    int64
	}
	h.db.Model(&models.SecurityAuditLog{}).
		Select("severity, COUNT(*) as count").
		Group("severity").
		Scan(&severityRows)
	for _, row := range severityRows {
		stats.EventsBySeverity[row.Severity] = row.Count
	}

	var eventTypeRows []struct {
		EventType string
		Count     int64
	}
	h.db.Model(&models.SecurityAuditLog{}).
		Select("event_type, COUNT(*) as count").
		Group("event_type").
		Order("count DESC").
		Limit(10).
		Scan(&eventTypeRows)
	stats.RecentEventTypes = make([]EventTypeCount, len(eventTypeRows))
	for i, row := range eventTypeRows {
		stats.RecentEventTypes[i] = EventTypeCount{
			EventType: row.EventType,
			Count:     row.Count,
		}
	}

	return c.JSON(http.StatusOK, GetStatsAPIResponse{
		Success: true,
		Data:    stats,
	})
}
