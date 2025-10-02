package operationlogs

import (
	"berth/internal/dto"
	"berth/models"
	"strconv"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	logger *logging.Service
}

func NewService(db *gorm.DB, logger *logging.Service) *Service {
	return &Service{
		db:     db,
		logger: logger,
	}
}

func (s *Service) calculatePartialDuration(log models.OperationLog) *int {
	if log.EndTime != nil {
		return nil
	}

	var lastMessage models.OperationLogMessage
	err := s.db.Where("operation_log_id = ?", log.ID).
		Order("timestamp DESC").
		First(&lastMessage).Error

	if err != nil {
		duration := int(time.Since(log.StartTime).Milliseconds())
		return &duration
	}

	duration := int(lastMessage.Timestamp.Sub(log.StartTime).Milliseconds())
	if duration < 0 {
		duration = int(time.Since(log.StartTime).Milliseconds())
	}
	return &duration
}

func (s *Service) ListOperationLogs(params ListOperationLogsParams) (*dto.PaginatedOperationLogs, error) {
	offset := (params.Page - 1) * params.PageSize

	query := s.db.Model(&models.OperationLog{}).
		Preload("User").
		Preload("Server").
		Preload("Webhook").
		Order("created_at DESC")

	if params.UserID != 0 {
		query = query.Where("user_id = ?", params.UserID)
	}

	if params.SearchTerm != "" {
		query = query.Where("stack_name LIKE ? OR command LIKE ? OR operation_id LIKE ?",
			"%"+params.SearchTerm+"%", "%"+params.SearchTerm+"%", "%"+params.SearchTerm+"%")
	}

	if params.ServerID != "" {
		query = query.Where("server_id = ?", params.ServerID)
	}

	if params.StackName != "" {
		query = query.Where("stack_name LIKE ?", "%"+params.StackName+"%")
	}

	if params.Command != "" {
		query = query.Where("command = ?", params.Command)
	}

	switch params.Status {
	case "complete":
		query = query.Where("end_time IS NOT NULL")
	case "incomplete":
		query = query.Where("end_time IS NULL")
	case "failed":
		query = query.Where("success = ? AND end_time IS NOT NULL", false)
	case "success":
		query = query.Where("success = ? AND end_time IS NOT NULL", true)
	}

	if params.DaysBack != nil {
		cutoffDate := time.Now().Add(-time.Duration(*params.DaysBack) * 24 * time.Hour)
		query = query.Where("created_at > ?", cutoffDate)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		s.logger.Error("failed to count operation logs", zap.Error(err))
		return nil, err
	}

	var logs []models.OperationLog
	if err := query.Offset(offset).Limit(params.PageSize).Find(&logs).Error; err != nil {
		s.logger.Error("failed to fetch operation logs", zap.Error(err))
		return nil, err
	}

	var response []dto.OperationLogResponse
	for _, log := range logs {
		var messageCount int64
		s.db.Model(&models.OperationLogMessage{}).Where("operation_log_id = ?", log.ID).Count(&messageCount)

		userName := "Unknown"
		if log.User.Username != "" {
			userName = log.User.Username
		} else if log.User.Email != "" {
			userName = log.User.Email
		}

		serverName := "Unknown"
		if log.Server.Name != "" {
			serverName = log.Server.Name
		}

		var webhookName *string
		triggerSource := "manual"
		if log.WebhookID != nil && log.Webhook != nil {
			webhookName = &log.Webhook.Name
			triggerSource = "webhook"
		}

		partialDuration := s.calculatePartialDuration(log)

		response = append(response, dto.OperationLogResponse{
			OperationLog:    log,
			UserName:        userName,
			ServerName:      serverName,
			WebhookName:     webhookName,
			TriggerSource:   triggerSource,
			IsIncomplete:    log.EndTime == nil,
			FormattedDate:   log.CreatedAt.Format("2006-01-02 15:04:05"),
			MessageCount:    messageCount,
			PartialDuration: partialDuration,
		})
	}

	totalPages := (int(total) + params.PageSize - 1) / params.PageSize

	return &dto.PaginatedOperationLogs{
		Data: response,
		Pagination: dto.PaginationInfo{
			CurrentPage: params.Page,
			PageSize:    params.PageSize,
			Total:       total,
			TotalPages:  totalPages,
			HasNext:     params.Page < totalPages,
			HasPrev:     params.Page > 1,
		},
	}, nil
}

func (s *Service) GetOperationLogDetails(logID uint, userID *uint) (*dto.OperationLogDetail, error) {
	query := s.db.Preload("User").Preload("Server").Preload("Webhook")

	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}

	var log models.OperationLog
	if err := query.First(&log, logID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to fetch operation log details", zap.Error(err), zap.Uint("log_id", logID))
		return nil, err
	}

	var messages []models.OperationLogMessage
	if err := s.db.Where("operation_log_id = ?", logID).
		Order("sequence_number ASC, timestamp ASC").
		Find(&messages).Error; err != nil {
		s.logger.Error("failed to fetch operation log messages", zap.Error(err), zap.Uint("log_id", logID))
		return nil, err
	}

	userName := "Unknown"
	if log.User.Username != "" {
		userName = log.User.Username
	} else if log.User.Email != "" {
		userName = log.User.Email
	}

	serverName := "Unknown"
	if log.Server.Name != "" {
		serverName = log.Server.Name
	}

	var webhookName *string
	triggerSource := "manual"
	if log.WebhookID != nil && log.Webhook != nil {
		webhookName = &log.Webhook.Name
		triggerSource = "webhook"
	}

	partialDuration := s.calculatePartialDuration(log)

	return &dto.OperationLogDetail{
		Log: dto.OperationLogResponse{
			OperationLog:    log,
			UserName:        userName,
			ServerName:      serverName,
			WebhookName:     webhookName,
			TriggerSource:   triggerSource,
			IsIncomplete:    log.EndTime == nil,
			FormattedDate:   log.CreatedAt.Format("2006-01-02 15:04:05"),
			MessageCount:    int64(len(messages)),
			PartialDuration: partialDuration,
		},
		Messages: messages,
	}, nil
}

func (s *Service) GetOperationLogsStats() (*dto.OperationLogStats, error) {
	var stats dto.OperationLogStats

	if err := s.db.Model(&models.OperationLog{}).Count(&stats.TotalOperations).Error; err != nil {
		s.logger.Error("failed to count total operations", zap.Error(err))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("end_time IS NULL").Count(&stats.IncompleteOperations).Error; err != nil {
		s.logger.Error("failed to count incomplete operations", zap.Error(err))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("success = ? AND end_time IS NOT NULL", false).Count(&stats.FailedOperations).Error; err != nil {
		s.logger.Error("failed to count failed operations", zap.Error(err))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("success = ? AND end_time IS NOT NULL", true).Count(&stats.SuccessfulOperations).Error; err != nil {
		s.logger.Error("failed to count successful operations", zap.Error(err))
		return nil, err
	}

	yesterday := time.Now().Add(-24 * time.Hour)
	if err := s.db.Model(&models.OperationLog{}).Where("created_at > ?", yesterday).Count(&stats.RecentOperations).Error; err != nil {
		s.logger.Error("failed to count recent operations", zap.Error(err))
		return nil, err
	}

	return &stats, nil
}

func (s *Service) GetUserOperationLogsStats(userID uint) (*dto.OperationLogStats, error) {
	var stats dto.OperationLogStats

	if err := s.db.Model(&models.OperationLog{}).Where("user_id = ?", userID).Count(&stats.TotalOperations).Error; err != nil {
		s.logger.Error("failed to count user total operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("user_id = ? AND end_time IS NULL", userID).Count(&stats.IncompleteOperations).Error; err != nil {
		s.logger.Error("failed to count user incomplete operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("user_id = ? AND success = ? AND end_time IS NOT NULL", userID, false).Count(&stats.FailedOperations).Error; err != nil {
		s.logger.Error("failed to count user failed operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	if err := s.db.Model(&models.OperationLog{}).Where("user_id = ? AND success = ? AND end_time IS NOT NULL", userID, true).Count(&stats.SuccessfulOperations).Error; err != nil {
		s.logger.Error("failed to count user successful operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	yesterday := time.Now().Add(-24 * time.Hour)
	if err := s.db.Model(&models.OperationLog{}).Where("user_id = ? AND created_at > ?", userID, yesterday).Count(&stats.RecentOperations).Error; err != nil {
		s.logger.Error("failed to count user recent operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	return &stats, nil
}

func (s *Service) GetRunningOperations(userID uint) ([]dto.OperationLogResponse, error) {
	heartbeatTimeout := time.Now().Add(-5 * time.Minute)

	var logs []models.OperationLog
	err := s.db.Model(&models.OperationLog{}).
		Preload("User").
		Preload("Server").
		Where("user_id = ?", userID).
		Where("end_time IS NULL").
		Where("(last_message_at IS NOT NULL AND last_message_at > ?) OR (last_message_at IS NULL AND start_time > ?)", heartbeatTimeout, heartbeatTimeout).
		Order("start_time DESC").
		Find(&logs).Error

	if err != nil {
		s.logger.Error("failed to fetch running operations", zap.Error(err), zap.Uint("user_id", userID))
		return nil, err
	}

	var response []dto.OperationLogResponse
	for _, log := range logs {
		var messageCount int64
		s.db.Model(&models.OperationLogMessage{}).Where("operation_log_id = ?", log.ID).Count(&messageCount)

		userName := "Unknown"
		if log.User.Username != "" {
			userName = log.User.Username
		} else if log.User.Email != "" {
			userName = log.User.Email
		}

		serverName := "Unknown"
		if log.Server.Name != "" {
			serverName = log.Server.Name
		}

		partialDuration := s.calculatePartialDuration(log)

		response = append(response, dto.OperationLogResponse{
			OperationLog:    log,
			UserName:        userName,
			ServerName:      serverName,
			IsIncomplete:    true,
			FormattedDate:   log.CreatedAt.Format("2006-01-02 15:04:05"),
			MessageCount:    messageCount,
			PartialDuration: partialDuration,
		})
	}

	s.logger.Info("fetched running operations", zap.Uint("user_id", userID), zap.Int("count", len(response)))

	return response, nil
}

type ListOperationLogsParams struct {
	Page       int
	PageSize   int
	SearchTerm string
	ServerID   string
	StackName  string
	Command    string
	Status     string
	UserID     uint
	DaysBack   *int
}

func NewListOperationLogsParamsFromQuery(params map[string]string) ListOperationLogsParams {
	page, _ := strconv.Atoi(params["page"])
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(params["page_size"])
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var daysBack *int
	if daysBackStr := params["days_back"]; daysBackStr != "" {
		if days, err := strconv.Atoi(daysBackStr); err == nil && days > 0 {
			daysBack = &days
		}
	}

	return ListOperationLogsParams{
		Page:       page,
		PageSize:   pageSize,
		SearchTerm: params["search"],
		ServerID:   params["server_id"],
		StackName:  params["stack_name"],
		Command:    params["command"],
		Status:     params["status"],
		DaysBack:   daysBack,
	}
}
