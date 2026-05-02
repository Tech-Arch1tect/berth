package operationlogs

import (
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Handler struct {
	db                      *gorm.DB
	service                 *Service
	inertiaSvc              *inertia.Service
	logger                  *zap.Logger
	operationTimeoutSeconds int
}

func NewHandler(db *gorm.DB, service *Service, inertiaSvc *inertia.Service, logger *zap.Logger, operationTimeoutSeconds int) *Handler {
	return &Handler{
		db:                      db,
		service:                 service,
		inertiaSvc:              inertiaSvc,
		logger:                  logger,
		operationTimeoutSeconds: operationTimeoutSeconds,
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
	userID, err := session.GetCurrentUserID(c)
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

	logs, total, err := h.service.ListOperationLogs(params)
	if err != nil {
		h.logger.Error("failed to list operation logs", zap.Error(err))
		return response.Internal(c, "Failed to retrieve operation logs")
	}

	return paginatedLogs(c, logs, params.Page, params.PageSize, total)
}

func (h *Handler) ListUserOperationLogs(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
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

	logs, total, err := h.service.ListOperationLogs(params)
	if err != nil {
		h.logger.Error("failed to list user operation logs", zap.Error(err), zap.Uint("user_id", userID))
		return response.Internal(c, "Failed to retrieve operation logs")
	}

	return paginatedLogs(c, logs, params.Page, params.PageSize, total)
}

func paginatedLogs(c echo.Context, logs []OperationLogInfo, page, pageSize int, total int64) error {
	totalCount := int(total)
	return response.Paginated(c, logs, response.Meta{
		Page:       &page,
		PageSize:   &pageSize,
		TotalCount: &totalCount,
	})
}

func (h *Handler) GetOperationLogDetails(c echo.Context) error {
	logID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	result, err := h.service.GetOperationLogDetails(logID, nil)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Operation log not found")
		}
		h.logger.Error("failed to get operation log details", zap.Error(err), zap.Uint("log_id", logID))
		return response.Internal(c, "Failed to retrieve operation log details")
	}

	return response.OK(c, *result)
}

func (h *Handler) GetUserOperationLogDetails(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	logID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	result, err := h.service.GetOperationLogDetails(logID, &userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Operation log not found")
		}
		h.logger.Error("failed to get user operation log details", zap.Error(err), zap.Uint("log_id", logID), zap.Uint("user_id", userID))
		return response.Internal(c, "Failed to retrieve operation log details")
	}

	return response.OK(c, *result)
}

func (h *Handler) GetOperationLogsStats(c echo.Context) error {
	stats, err := h.service.GetOperationLogsStats()
	if err != nil {
		h.logger.Error("failed to get operation logs stats", zap.Error(err))
		return response.Internal(c, "Failed to retrieve operation logs statistics")
	}

	return response.OK(c, *stats)
}

func (h *Handler) GetUserOperationLogsStats(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	stats, err := h.service.GetUserOperationLogsStats(userID)
	if err != nil {
		h.logger.Error("failed to get user operation logs stats", zap.Error(err), zap.Uint("user_id", userID))
		return response.Internal(c, "Failed to retrieve operation logs statistics")
	}

	return response.OK(c, *stats)
}

func (h *Handler) GetRunningOperations(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	operations, err := h.service.GetRunningOperations(userID)
	if err != nil {
		h.logger.Error("failed to get running operations", zap.Error(err), zap.Uint("user_id", userID))
		return response.Internal(c, "Failed to retrieve running operations")
	}

	return response.OK(c, RunningOperationsData{Operations: operations})
}

func (h *Handler) GetOperationLogDetailsByOperationID(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	operationID := c.Param("operationId")
	if operationID == "" {
		return response.BadRequest(c, "Operation ID is required")
	}

	result, err := h.service.GetOperationLogDetailsByOperationID(operationID, &userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Operation log not found")
		}
		h.logger.Error("failed to get operation log details by operation_id", zap.Error(err), zap.String("operation_id", operationID), zap.Uint("user_id", userID))
		return response.Internal(c, "Failed to retrieve operation log details")
	}

	return response.OK(c, *result)
}
