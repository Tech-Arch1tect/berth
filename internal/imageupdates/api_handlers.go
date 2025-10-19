package imageupdates

import (
	"berth/internal/common"
	"berth/internal/rbac"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type APIHandler struct {
	service *Service
	rbacSvc *rbac.Service
	logger  *logging.Service
}

func NewAPIHandler(service *Service, rbacSvc *rbac.Service, logger *logging.Service) *APIHandler {
	return &APIHandler{
		service: service,
		rbacSvc: rbacSvc,
		logger:  logger,
	}
}

func (h *APIHandler) ListAvailableUpdates(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.SendUnauthorized(c, "Authentication required")
	}

	allUpdates, err := h.service.GetAvailableUpdates()
	if err != nil {
		h.logger.Error("failed to fetch available updates",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return common.SendError(c, 500, "Failed to fetch updates")
	}

	accessibleServerIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(userID)
	if err != nil {
		h.logger.Error("failed to get user accessible servers",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return common.SendInternalError(c, "Failed to check server access")
	}

	serverIDMap := make(map[uint]bool)
	for _, id := range accessibleServerIDs {
		serverIDMap[id] = true
	}

	accessibleUpdates := make([]map[string]any, 0)
	for _, update := range allUpdates {
		if !serverIDMap[update.ServerID] {
			continue
		}

		hasPermission, err := h.rbacSvc.UserHasStackPermission(
			userID,
			update.ServerID,
			update.StackName,
			"stacks.read",
		)
		if err != nil {
			h.logger.Warn("failed to check stack permission",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.Uint("server_id", update.ServerID),
				zap.String("stack_name", update.StackName),
			)
			continue
		}

		if !hasPermission {
			continue
		}

		accessibleUpdates = append(accessibleUpdates, map[string]any{
			"id":                  update.ID,
			"server_id":           update.ServerID,
			"stack_name":          update.StackName,
			"container_name":      update.ContainerName,
			"current_image_name":  update.CurrentImageName,
			"current_repo_digest": update.CurrentRepoDigest,
			"latest_repo_digest":  update.LatestRepoDigest,
			"update_available":    update.UpdateAvailable,
			"last_checked_at":     update.LastCheckedAt,
			"check_error":         update.CheckError,
			"created_at":          update.CreatedAt,
			"updated_at":          update.UpdatedAt,
		})
	}

	h.logger.Debug("filtered available updates by permissions",
		zap.Uint("user_id", userID),
		zap.Int("total_updates", len(allUpdates)),
		zap.Int("accessible_updates", len(accessibleUpdates)),
	)

	return common.SendSuccess(c, map[string]any{"updates": accessibleUpdates})
}

func (h *APIHandler) ListServerUpdates(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.SendUnauthorized(c, "Authentication required")
	}

	serverID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return common.SendBadRequest(c, "Invalid server ID")
	}

	serverIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(userID)
	if err != nil {
		h.logger.Error("failed to get user accessible servers",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return common.SendInternalError(c, "Failed to check server access")
	}

	hasServerAccess := false
	for _, id := range serverIDs {
		if id == serverID {
			hasServerAccess = true
			break
		}
	}

	if !hasServerAccess {
		h.logger.Warn("user attempted to access server without permission",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return common.SendForbidden(c, "You do not have access to this server")
	}

	allUpdates, err := h.service.GetServerUpdates(serverID)
	if err != nil {
		h.logger.Error("failed to fetch server updates",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return common.SendError(c, 500, "Failed to fetch updates")
	}

	accessibleUpdates := make([]map[string]any, 0)
	for _, update := range allUpdates {
		hasPermission, err := h.rbacSvc.UserHasStackPermission(
			userID,
			serverID,
			update.StackName,
			"stacks.read",
		)
		if err != nil {
			h.logger.Warn("failed to check stack permission",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.String("stack_name", update.StackName),
			)
			continue
		}

		if hasPermission {
			accessibleUpdates = append(accessibleUpdates, map[string]any{
				"id":                  update.ID,
				"server_id":           update.ServerID,
				"stack_name":          update.StackName,
				"container_name":      update.ContainerName,
				"current_image_name":  update.CurrentImageName,
				"current_repo_digest": update.CurrentRepoDigest,
				"latest_repo_digest":  update.LatestRepoDigest,
				"update_available":    update.UpdateAvailable,
				"last_checked_at":     update.LastCheckedAt,
				"check_error":         update.CheckError,
				"created_at":          update.CreatedAt,
				"updated_at":          update.UpdatedAt,
			})
		}
	}

	h.logger.Debug("filtered server updates by permissions",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.Int("total_updates", len(allUpdates)),
		zap.Int("accessible_updates", len(accessibleUpdates)),
	)

	return common.SendSuccess(c, map[string]any{"updates": accessibleUpdates})
}
