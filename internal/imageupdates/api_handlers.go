package imageupdates

import (
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/rbac"
	"berth/internal/session"
	"context"
	"time"

	"github.com/labstack/echo/v4"
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
	Success bool                  `json:"success"`
	Data    ImageUpdatesDataInner `json:"data"`
}

type ImageUpdatesDataInner struct {
	Updates []ImageUpdate `json:"updates"`
}

type imageupdatesPermissionChecker interface {
	GetUserAccessibleServerIDs(ctx context.Context, userID uint) ([]uint, error)
	UserHasStackPermission(ctx context.Context, userID, serverID uint, stackname, permissionName string) (bool, error)
}

type APIHandler struct {
	service *Service
	rbacSvc imageupdatesPermissionChecker
	logger  *zap.Logger
}

func NewAPIHandler(service *Service, rbacSvc imageupdatesPermissionChecker, logger *zap.Logger) *APIHandler {
	return &APIHandler{
		service: service,
		rbacSvc: rbacSvc,
		logger:  logger,
	}
}

func (h *APIHandler) ListAvailableUpdates(c echo.Context) error {
	ctx := c.Request().Context()
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.SendUnauthorized(c, "Authentication required")
	}

	allUpdates, err := h.service.GetAvailableUpdates()
	if err != nil {
		h.logger.Error("failed to fetch available updates",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return response.SendError(c, 500, "Failed to fetch updates")
	}

	accessibleServerIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
	if err != nil {
		h.logger.Error("failed to get user accessible servers",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return response.SendInternalError(c, "Failed to check server access")
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
			rbac.PermStacksRead,
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

	return response.SendSuccess(c, ImageUpdatesResponse{
		Success: true,
		Data:    ImageUpdatesDataInner{Updates: accessibleUpdates},
	})
}

func (h *APIHandler) ListServerUpdates(c echo.Context) error {
	ctx := c.Request().Context()
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return response.SendUnauthorized(c, "Authentication required")
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return response.SendBadRequest(c, "Invalid server ID")
	}

	serverIDs, err := h.rbacSvc.GetUserAccessibleServerIDs(ctx, userID)
	if err != nil {
		h.logger.Error("failed to get user accessible servers",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return response.SendInternalError(c, "Failed to check server access")
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
		return response.SendForbidden(c, "You do not have access to this server")
	}

	allUpdates, err := h.service.GetServerUpdates(serverID)
	if err != nil {
		h.logger.Error("failed to fetch server updates",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return response.SendError(c, 500, "Failed to fetch updates")
	}

	accessibleUpdates := make([]ImageUpdate, 0)
	for _, update := range allUpdates {
		hasPermission, err := h.rbacSvc.UserHasStackPermission(
			ctx,
			userID,
			serverID,
			update.StackName,
			rbac.PermStacksRead,
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

	return response.SendSuccess(c, ImageUpdatesResponse{
		Success: true,
		Data:    ImageUpdatesDataInner{Updates: accessibleUpdates},
	})
}
