package imageupdates

import (
	"time"

	"berth/internal/domain/authz"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

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

type ImageUpdatesData struct {
	Updates []ImageUpdate `json:"updates"`
}

type APIHandler struct {
	service *Service
	logger  *zap.Logger
}

func NewAPIHandler(service *Service, logger *zap.Logger) *APIHandler {
	return &APIHandler{
		service: service,
		logger:  logger,
	}
}

func (h *APIHandler) ListAvailableUpdates(c echo.Context) error {
	scope, ok := authz.GetScopeSet(c)
	if !ok {
		return response.Internal(c, "Failed to fetch updates")
	}

	allUpdates, err := h.service.GetAvailableUpdates()
	if err != nil {
		h.logger.Error("failed to fetch available updates", zap.Error(err))
		return response.Internal(c, "Failed to fetch updates")
	}

	accessibleUpdates := make([]ImageUpdate, 0)
	for _, update := range allUpdates {
		if !scope.AllowsStack(update.ServerID, update.StackName) {
			continue
		}
		accessibleUpdates = append(accessibleUpdates, toImageUpdate(update))
	}

	return response.OK(c, ImageUpdatesData{Updates: accessibleUpdates})
}

func (h *APIHandler) ListServerUpdates(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return response.BadRequest(c, "Invalid server ID")
	}

	scope, ok := authz.GetScopeSet(c)
	if !ok {
		return response.Internal(c, "Failed to fetch updates")
	}

	allUpdates, err := h.service.GetServerUpdates(serverID)
	if err != nil {
		h.logger.Error("failed to fetch server updates",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return response.Internal(c, "Failed to fetch updates")
	}

	accessibleUpdates := make([]ImageUpdate, 0)
	for _, update := range allUpdates {
		if !scope.AllowsStack(serverID, update.StackName) {
			continue
		}
		accessibleUpdates = append(accessibleUpdates, toImageUpdate(update))
	}

	return response.OK(c, ImageUpdatesData{Updates: accessibleUpdates})
}

func toImageUpdate(update ContainerImageUpdate) ImageUpdate {
	return ImageUpdate{
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
	}
}
