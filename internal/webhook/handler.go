package webhook

import (
	"berth/internal/common"
	"berth/internal/queue"
	"berth/internal/rbac"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/stack"
	"berth/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	webhookSvc *Service
	queueSvc   *queue.Service
	serverSvc  *server.Service
	rbacSvc    *rbac.Service
	stackSvc   *stack.Service
	inertiaSvc *inertia.Service
	auditSvc   *security.AuditService
}

func NewHandler(db *gorm.DB, webhookSvc *Service, queueSvc *queue.Service, serverSvc *server.Service, rbacSvc *rbac.Service, stackSvc *stack.Service, inertiaSvc *inertia.Service, auditSvc *security.AuditService) *Handler {
	return &Handler{
		db:         db,
		webhookSvc: webhookSvc,
		queueSvc:   queueSvc,
		serverSvc:  serverSvc,
		rbacSvc:    rbacSvc,
		stackSvc:   stackSvc,
		inertiaSvc: inertiaSvc,
		auditSvc:   auditSvc,
	}
}

func (h *Handler) CreateWebhook(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	var req CreateWebhookRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	webhook, err := h.webhookSvc.CreateWebhook(userID, req)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookCreated,
			actorUser.ID,
			actorUser.Username,
			webhook.ID,
			webhook.Name,
			c.RealIP(),
			true,
			"",
			map[string]any{
				"stack_pattern": webhook.StackPattern,
			},
		)
	}

	return common.SendSuccess(c, webhook)
}

func (h *Handler) GetWebhooks(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	webhooks, err := h.webhookSvc.GetUserWebhooks(userID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, webhooks)
}

func (h *Handler) GetWebhook(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	webhook, err := h.webhookSvc.GetWebhook(webhookID, userID)
	if err != nil {
		if err.Error() == "webhook not found" {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, err.Error())
	}

	return common.SendSuccess(c, webhook)
}

func (h *Handler) UpdateWebhook(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req UpdateWebhookRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	webhook, err := h.webhookSvc.UpdateWebhook(webhookID, userID, req)
	if err != nil {
		if err.Error() == "webhook not found" {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookUpdated,
			actorUser.ID,
			actorUser.Username,
			webhook.ID,
			webhook.Name,
			c.RealIP(),
			true,
			"",
			map[string]any{
				"stack_pattern": webhook.StackPattern,
			},
		)
	}

	return common.SendSuccess(c, webhook)
}

func (h *Handler) DeleteWebhook(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	webhook, err := h.webhookSvc.GetWebhook(webhookID, userID)
	if err != nil {
		if err.Error() == "webhook not found" {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, err.Error())
	}

	err = h.webhookSvc.DeleteWebhook(webhookID, userID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookDeleted,
			actorUser.ID,
			actorUser.Username,
			webhook.ID,
			webhook.Name,
			c.RealIP(),
			true,
			"",
			nil,
		)
	}

	return common.SendSuccess(c, map[string]string{"message": "Webhook deleted successfully"})
}

func (h *Handler) RegenerateAPIKey(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	webhook, err := h.webhookSvc.GetWebhook(webhookID, userID)
	if err != nil {
		if err.Error() == "webhook not found" {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, err.Error())
	}

	apiKey, err := h.webhookSvc.RegenerateAPIKey(webhookID, userID)
	if err != nil {
		return common.SendInternalError(c, err.Error())
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookAPIKeyRegenerated,
			actorUser.ID,
			actorUser.Username,
			webhook.ID,
			webhook.Name,
			c.RealIP(),
			true,
			"",
			nil,
		)
	}

	return common.SendSuccess(c, map[string]string{
		"api_key": apiKey,
		"message": "API key regenerated successfully",
	})
}

func (h *Handler) TriggerWebhook(c echo.Context) error {
	webhookIDStr := c.Param("id")
	webhookID, err := strconv.ParseUint(webhookIDStr, 10, 32)
	if err != nil {
		return common.SendBadRequest(c, "Invalid webhook ID")
	}

	var req TriggerWebhookRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if err := req.Validate(); err != nil {
		return common.SendBadRequest(c, err.Error())
	}

	webhook, err := h.webhookSvc.ValidateAPIKey(uint(webhookID), req.APIKey)
	if err != nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookAuthorizationFailed,
			0,
			"",
			uint(webhookID),
			"",
			c.RealIP(),
			false,
			"Invalid API key",
			nil,
		)
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "Invalid webhook or API key",
		})
	}

	if err := h.webhookSvc.ValidateWebhookStackPattern(webhook, req.StackName); err != nil {
		return echo.NewHTTPError(http.StatusForbidden, map[string]string{
			"error": err.Error(),
		})
	}

	_, err = h.serverSvc.GetActiveServerForUser(req.ServerID, webhook.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusForbidden, map[string]string{
			"error": "Server not found or access denied",
		})
	}

	hasPermission, err := h.rbacSvc.UserHasStackPermission(webhook.UserID, req.ServerID, req.StackName, "stacks.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return echo.NewHTTPError(http.StatusForbidden, map[string]string{
			"error": "Insufficient permissions for this stack",
		})
	}

	_, err = h.stackSvc.GetStackDetails(c.Request().Context(), webhook.UserID, req.ServerID, req.StackName)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, map[string]string{
			"error": "Stack not found on server",
		})
	}

	go h.webhookSvc.UpdateWebhookUsage(uint(webhookID))

	var actorUser models.User
	h.db.First(&actorUser, webhook.UserID)

	if req.Command != "" {

		operationReq := req.ToOperationRequest()

		response, err := h.queueSvc.EnqueueOperation(
			webhook.UserID,
			req.ServerID,
			req.StackName,
			operationReq,
			&webhook.ID,
		)
		if err != nil {
			if actorUser.ID > 0 {
				_ = h.auditSvc.LogWebhookEvent(
					security.EventWebhookTriggerFailed,
					actorUser.ID,
					actorUser.Username,
					webhook.ID,
					webhook.Name,
					c.RealIP(),
					false,
					err.Error(),
					map[string]any{
						"command":    req.Command,
						"stack_name": req.StackName,
						"server_id":  req.ServerID,
					},
				)
			}
			return common.SendInternalError(c, err.Error())
		}

		if actorUser.ID > 0 {
			_ = h.auditSvc.LogWebhookEvent(
				security.EventWebhookTriggered,
				actorUser.ID,
				actorUser.Username,
				webhook.ID,
				webhook.Name,
				c.RealIP(),
				true,
				"",
				map[string]any{
					"command":      req.Command,
					"stack_name":   req.StackName,
					"server_id":    req.ServerID,
					"operation_id": response.OperationID,
				},
			)
		}

		return common.SendSuccess(c, TriggerWebhookResponse{
			OperationID:        response.OperationID,
			EstimatedStartTime: response.EstimatedStartAt,
		})
	} else {

		operationReqs := req.ToOperationRequests()

		batchResponse, err := h.queueSvc.EnqueueOperations(
			webhook.UserID,
			req.ServerID,
			req.StackName,
			operationReqs,
			&webhook.ID,
		)
		if err != nil {
			if actorUser.ID > 0 {
				_ = h.auditSvc.LogWebhookEvent(
					security.EventWebhookTriggerFailed,
					actorUser.ID,
					actorUser.Username,
					webhook.ID,
					webhook.Name,
					c.RealIP(),
					false,
					err.Error(),
					map[string]any{
						"operations": req.Operations,
						"stack_name": req.StackName,
						"server_id":  req.ServerID,
					},
				)
			}
			return common.SendInternalError(c, err.Error())
		}

		if actorUser.ID > 0 {
			_ = h.auditSvc.LogWebhookEvent(
				security.EventWebhookTriggered,
				actorUser.ID,
				actorUser.Username,
				webhook.ID,
				webhook.Name,
				c.RealIP(),
				true,
				"",
				map[string]any{
					"operations": req.Operations,
					"stack_name": req.StackName,
					"server_id":  req.ServerID,
					"batch_id":   batchResponse.BatchID,
				},
			)
		}

		operations := make([]TriggerOperationResponse, len(batchResponse.Operations))
		for i, op := range batchResponse.Operations {
			operations[i] = TriggerOperationResponse{
				OperationID:     op.OperationID,
				Command:         op.Command,
				Status:          string(op.Status),
				PositionInQueue: op.PositionInQueue,
				Order:           op.Order,
				DependsOn:       op.DependsOn,
			}
		}

		return common.SendSuccess(c, TriggerWebhookResponse{
			BatchID:               batchResponse.BatchID,
			Operations:            operations,
			EstimatedStartTime:    batchResponse.EstimatedStartTime,
			EstimatedCompleteTime: batchResponse.EstimatedCompleteTime,
		})
	}
}

// Admin methods

func (h *Handler) ShowAdminWebhooks(c echo.Context) error {
	return h.inertiaSvc.Render(c, "Admin/Webhooks", gonertia.Props{
		"title": "Admin Webhooks",
	})
}

func (h *Handler) AdminListWebhooks(c echo.Context) error {
	webhooks, err := h.webhookSvc.GetAllWebhooks()
	if err != nil {
		return common.SendInternalError(c, "Failed to retrieve webhooks")
	}

	return common.SendSuccess(c, webhooks)
}

func (h *Handler) AdminGetWebhook(c echo.Context) error {
	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	webhook, err := h.webhookSvc.AdminGetWebhook(webhookID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, "Failed to retrieve webhook")
	}

	return common.SendSuccess(c, webhook)
}

func (h *Handler) AdminDeleteWebhook(c echo.Context) error {
	webhookID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var webhook models.Webhook
	if err := h.db.First(&webhook, webhookID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return common.SendNotFound(c, "Webhook not found")
		}
		return common.SendInternalError(c, "Failed to retrieve webhook")
	}

	err = h.webhookSvc.AdminDeleteWebhook(webhookID)
	if err != nil {
		return common.SendInternalError(c, "Failed to delete webhook")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogWebhookEvent(
			security.EventWebhookDeleted,
			actorUser.ID,
			actorUser.Username,
			webhook.ID,
			webhook.Name,
			c.RealIP(),
			true,
			"",
			map[string]any{
				"admin_action": true,
				"owner_id":     webhook.UserID,
			},
		)
	}

	return common.SendSuccess(c, map[string]string{
		"message": "Webhook deleted successfully",
	})
}
