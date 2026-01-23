package imageupdates

import (
	"berth/internal/common"
	"berth/internal/rbac"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type ImageUpdate struct {
	ID                uint       `json:"id"`
	ServerID          uint       `json:"server_id"`
	StackName         string     `json:"stack_name"`
	ContainerName     string     `json:"container_name"`
	CurrentImageName  string     `json:"current_image_name"`
	CurrentRepoDigest string     `json:"current_repo_digest"`
	LatestRepoDigest  string     `json:"latest_repo_digest"`
	UpdateAvailable   bool       `json:"update_available"`
	LastCheckedAt     *time.Time `json:"last_checked_at"`
	CheckError        string     `json:"check_error"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type ImageUpdatesResponse struct {
	Updates []ImageUpdate `json:"updates"`
}

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
	ctx := c.Request().Context()
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

	accessibleServerIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
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

	accessibleUpdates := make([]ImageUpdate, 0)
	for _, update := range allUpdates {
		if !serverIDMap[update.ServerID] {
			continue
		}

		hasPermission, err := h.rbacSvc.UserHasStackPermission(
			ctx,
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

		accessibleUpdates = append(accessibleUpdates, ImageUpdate{
			ID:                update.ID,
			ServerID:          update.ServerID,
			StackName:         update.StackName,
			ContainerName:     update.ContainerName,
			CurrentImageName:  update.CurrentImageName,
			CurrentRepoDigest: update.CurrentRepoDigest,
			LatestRepoDigest:  update.LatestRepoDigest,
			UpdateAvailable:   update.UpdateAvailable,
			LastCheckedAt:     update.LastCheckedAt,
			CheckError:        update.CheckError,
			CreatedAt:         update.CreatedAt,
			UpdatedAt:         update.UpdatedAt,
		})
	}

	h.logger.Debug("filtered available updates by permissions",
		zap.Uint("user_id", userID),
		zap.Int("total_updates", len(allUpdates)),
		zap.Int("accessible_updates", len(accessibleUpdates)),
	)

	return common.SendSuccess(c, ImageUpdatesResponse{Updates: accessibleUpdates})
}

func (h *APIHandler) ListServerUpdates(c echo.Context) error {
	ctx := c.Request().Context()
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return common.SendUnauthorized(c, "Authentication required")
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return common.SendBadRequest(c, "Invalid server ID")
	}

	serverIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
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

	accessibleUpdates := make([]ImageUpdate, 0)
	for _, update := range allUpdates {
		hasPermission, err := h.rbacSvc.UserHasStackPermission(
			ctx,
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
			accessibleUpdates = append(accessibleUpdates, ImageUpdate{
				ID:                update.ID,
				ServerID:          update.ServerID,
				StackName:         update.StackName,
				ContainerName:     update.ContainerName,
				CurrentImageName:  update.CurrentImageName,
				CurrentRepoDigest: update.CurrentRepoDigest,
				LatestRepoDigest:  update.LatestRepoDigest,
				UpdateAvailable:   update.UpdateAvailable,
				LastCheckedAt:     update.LastCheckedAt,
				CheckError:        update.CheckError,
				CreatedAt:         update.CreatedAt,
				UpdatedAt:         update.UpdatedAt,
			})
		}
	}

	h.logger.Debug("filtered server updates by permissions",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.Int("total_updates", len(allUpdates)),
		zap.Int("accessible_updates", len(accessibleUpdates)),
	)

	return common.SendSuccess(c, ImageUpdatesResponse{Updates: accessibleUpdates})
}
