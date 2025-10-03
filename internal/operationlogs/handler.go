package operationlogs

import (
	"berth/internal/common"
	"berth/models"
	"encoding/json"
	"fmt"
	"time"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	service    *Service
	inertiaSvc *inertia.Service
	logger     *logging.Service
}

func NewHandler(db *gorm.DB, service *Service, inertiaSvc *inertia.Service, logger *logging.Service) *Handler {
	return &Handler{
		db:         db,
		service:    service,
		inertiaSvc: inertiaSvc,
		logger:     logger,
	}
}

func (h *Handler) ShowOperationLogs(c echo.Context) error {
	h.logger.Info("operation logs page accessed",
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("remote_ip", c.RealIP()),
	)

	return h.inertiaSvc.Render(c, "Admin/OperationLogs", gonertia.Props{
		"title": "Operation Logs",
	})
}

func (h *Handler) ShowUserOperationLogs(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	h.logger.Info("user operation logs page accessed",
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("remote_ip", c.RealIP()),
		zap.Uint("user_id", userID),
	)

	return h.inertiaSvc.Render(c, "OperationLogs", gonertia.Props{
		"title": "My Operation Logs",
	})
}

func (h *Handler) ListOperationLogs(c echo.Context) error {
	params := NewListOperationLogsParamsFromQuery(map[string]string{
		"page":       c.QueryParam("page"),
		"page_size":  c.QueryParam("page_size"),
		"search":     c.QueryParam("search"),
		"server_id":  c.QueryParam("server_id"),
		"stack_name": c.QueryParam("stack_name"),
		"command":    c.QueryParam("command"),
		"status":     c.QueryParam("status"),
	})

	result, err := h.service.ListOperationLogs(params)
	if err != nil {
		h.logger.Error("failed to list operation logs", zap.Error(err))
		return common.SendInternalError(c, "Failed to retrieve operation logs")
	}

	return common.SendSuccess(c, result)
}

func (h *Handler) ListUserOperationLogs(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	params := NewListOperationLogsParamsFromQuery(map[string]string{
		"page":       c.QueryParam("page"),
		"page_size":  c.QueryParam("page_size"),
		"search":     c.QueryParam("search"),
		"server_id":  c.QueryParam("server_id"),
		"stack_name": c.QueryParam("stack_name"),
		"command":    c.QueryParam("command"),
		"status":     c.QueryParam("status"),
	})
	params.UserID = userID

	result, err := h.service.ListOperationLogs(params)
	if err != nil {
		h.logger.Error("failed to list user operation logs", zap.Error(err), zap.Uint("user_id", userID))
		return common.SendInternalError(c, "Failed to retrieve operation logs")
	}

	return common.SendSuccess(c, result)
}

func (h *Handler) GetOperationLogDetails(c echo.Context) error {
	logID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	result, err := h.service.GetOperationLogDetails(logID, nil)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return common.SendNotFound(c, "Operation log not found")
		}
		h.logger.Error("failed to get operation log details", zap.Error(err), zap.Uint("log_id", logID))
		return common.SendInternalError(c, "Failed to retrieve operation log details")
	}

	return common.SendSuccess(c, result)
}

func (h *Handler) GetUserOperationLogDetails(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	logID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	result, err := h.service.GetOperationLogDetails(logID, &userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return common.SendNotFound(c, "Operation log not found")
		}
		h.logger.Error("failed to get user operation log details", zap.Error(err), zap.Uint("log_id", logID), zap.Uint("user_id", userID))
		return common.SendInternalError(c, "Failed to retrieve operation log details")
	}

	return common.SendSuccess(c, result)
}

func (h *Handler) GetOperationLogsStats(c echo.Context) error {
	stats, err := h.service.GetOperationLogsStats()
	if err != nil {
		h.logger.Error("failed to get operation logs stats", zap.Error(err))
		return common.SendInternalError(c, "Failed to retrieve operation logs statistics")
	}

	return common.SendSuccess(c, stats)
}

func (h *Handler) GetUserOperationLogsStats(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	stats, err := h.service.GetUserOperationLogsStats(userID)
	if err != nil {
		h.logger.Error("failed to get user operation logs stats", zap.Error(err), zap.Uint("user_id", userID))
		return common.SendInternalError(c, "Failed to retrieve operation logs statistics")
	}

	return common.SendSuccess(c, stats)
}

func (h *Handler) GetRunningOperations(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	operations, err := h.service.GetRunningOperations(userID)
	if err != nil {
		h.logger.Error("failed to get running operations", zap.Error(err), zap.Uint("user_id", userID))
		return common.SendInternalError(c, "Failed to retrieve running operations")
	}

	return common.SendSuccess(c, operations)
}

func (h *Handler) StreamOperationLogs(c echo.Context) error {
	operationID := c.Param("operation_id")
	if operationID == "" {
		return common.SendBadRequest(c, "operation_id is required")
	}

	apiKey := c.Request().Header.Get("X-API-Key")
	if apiKey == "" {
		apiKey = c.QueryParam("api_key")
	}
	if apiKey == "" {
		return common.SendUnauthorized(c, "API key is required")
	}

	var opLog models.OperationLog
	var err error
	maxWaitTime := 30 * time.Second
	pollInterval := 100 * time.Millisecond
	deadline := time.Now().Add(maxWaitTime)

	for time.Now().Before(deadline) {
		err = h.db.Preload("Webhook").Where("operation_id = ?", operationID).First(&opLog).Error
		if err == nil {
			break
		}
		if err != gorm.ErrRecordNotFound {
			return common.SendInternalError(c, "Failed to find operation")
		}
		time.Sleep(pollInterval)
	}

	if err != nil {
		return common.SendNotFound(c, "Operation not found")
	}

	if opLog.WebhookID == nil {
		return common.SendForbidden(c, "This operation was not triggered by a webhook")
	}

	if opLog.Webhook.ID == 0 {
		return common.SendInternalError(c, "Failed to load webhook information")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(opLog.Webhook.APIKeyHash), []byte(apiKey)); err != nil {
		return common.SendUnauthorized(c, "Invalid API key")
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/event-stream")
	c.Response().Header().Set(echo.HeaderCacheControl, "no-cache")
	c.Response().Header().Set(echo.HeaderConnection, "keep-alive")
	c.Response().WriteHeader(200)

	var lastSeq int
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	timeout := time.NewTimer(35 * time.Minute)
	defer timeout.Stop()

	for {
		select {
		case <-c.Request().Context().Done():
			return nil

		case <-timeout.C:
			return nil

		case <-ticker.C:
			var messages []models.OperationLogMessage
			h.db.Where("operation_log_id = ? AND sequence_number > ?", opLog.ID, lastSeq).
				Order("sequence_number ASC").
				Find(&messages)

			for _, msg := range messages {
				data := map[string]any{
					"type":      msg.MessageType,
					"data":      msg.MessageData,
					"timestamp": msg.Timestamp,
				}

				jsonData, _ := json.Marshal(data)
				fmt.Fprintf(c.Response(), "data: %s\n\n", jsonData)
				c.Response().Flush()

				lastSeq = msg.SequenceNumber
			}

			h.db.First(&opLog, opLog.ID)

			if opLog.Status == models.OperationStatusCompleted || opLog.Status == models.OperationStatusFailed {
				success := opLog.Success != nil && *opLog.Success
				exitCode := 0
				if opLog.ExitCode != nil {
					exitCode = *opLog.ExitCode
				}

				completeData := map[string]any{
					"type":      "complete",
					"success":   success,
					"exitCode":  exitCode,
					"timestamp": time.Now(),
				}

				jsonData, _ := json.Marshal(completeData)
				fmt.Fprintf(c.Response(), "data: %s\n\n", jsonData)
				c.Response().Flush()

				return nil
			}
		}
	}
}
