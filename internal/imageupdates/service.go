package imageupdates

import (
	"berth/internal/config"
	"berth/models"
	"berth/utils"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type agentClient interface {
	MakeRequest(ctx context.Context, server *models.Server, method, endpoint string, payload any) (*http.Response, error)
}

type serverProvider interface {
	GetServer(id uint) (*models.Server, error)
}

type Service struct {
	db                 *gorm.DB
	agentSvc           agentClient
	serverSvc          serverProvider
	crypto             *utils.Crypto
	logger             *logging.Service
	interval           time.Duration
	enabled            bool
	disabledRegistries map[string]bool
	ctx                context.Context
	cancel             context.CancelFunc
}

func NewService(db *gorm.DB, agentSvc agentClient, serverSvc serverProvider,
	crypto *utils.Crypto, logger *logging.Service, cfg *config.BerthConfig) *Service {

	interval, err := time.ParseDuration(cfg.Custom.ImageUpdateCheckInterval)
	if err != nil {
		logger.Warn("Invalid IMAGE_UPDATE_CHECK_INTERVAL, using default 6h",
			zap.String("value", cfg.Custom.ImageUpdateCheckInterval),
			zap.Error(err),
		)
		interval = 6 * time.Hour
	}

	disabledRegistries := make(map[string]bool)
	if cfg.Custom.ImageUpdateCheckDisabledRegistries != "" {
		registries := strings.Split(cfg.Custom.ImageUpdateCheckDisabledRegistries, ",")
		for _, registry := range registries {
			normalized := utils.NormalizeRegistryURL(strings.TrimSpace(registry))
			if normalized != "" {
				disabledRegistries[normalized] = true
			}
		}
		if len(disabledRegistries) > 0 {
			logger.Info("image update check will skip disabled registries",
				zap.Int("count", len(disabledRegistries)),
				zap.String("registries", cfg.Custom.ImageUpdateCheckDisabledRegistries),
			)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())

	svc := &Service{
		db:                 db,
		agentSvc:           agentSvc,
		serverSvc:          serverSvc,
		crypto:             crypto,
		logger:             logger,
		interval:           interval,
		enabled:            cfg.Custom.ImageUpdateCheckEnabled,
		disabledRegistries: disabledRegistries,
		ctx:                ctx,
		cancel:             cancel,
	}

	if svc.enabled {
		logger.Info("image update check is enabled, starting background job",
			zap.Duration("interval", interval),
		)
		go svc.checkLoop()
	} else {
		logger.Info("image update check is disabled via configuration")
	}

	return svc
}

func (s *Service) checkLoop() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	s.checkAllServers()

	for {
		select {
		case <-ticker.C:
			s.checkAllServers()
		case <-s.ctx.Done():
			return
		}
	}
}

func (s *Service) checkAllServers() {
	s.logger.Info("starting image update check for all servers")

	var servers []models.Server
	if err := s.db.Find(&servers).Error; err != nil {
		s.logger.Error("failed to fetch servers for image update check", zap.Error(err))
		return
	}

	for _, server := range servers {
		s.checkServer(server.ID)
	}

	s.logger.Info("completed image update check for all servers",
		zap.Int("server_count", len(servers)),
	)
}

func (s *Service) checkServer(serverID uint) {
	s.logger.Debug("checking server for image updates", zap.Uint("server_id", serverID))

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return
	}

	var credentials []models.ServerRegistryCredential
	if err := s.db.Where("server_id = ?", serverID).Find(&credentials).Error; err != nil {
		s.logger.Error("failed to fetch registry credentials",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return
	}

	agentCredentials := make([]AgentRegistryCredential, 0, len(credentials))
	for _, cred := range credentials {
		decryptedPassword, err := s.crypto.Decrypt(cred.Password)
		if err != nil {
			s.logger.Error("failed to decrypt registry credential password",
				zap.Uint("credential_id", cred.ID),
				zap.Error(err),
			)
			continue
		}

		agentCredentials = append(agentCredentials, AgentRegistryCredential{
			Registry:     cred.RegistryURL,
			Username:     cred.Username,
			Password:     decryptedPassword,
			StackPattern: cred.StackPattern,
			ImagePattern: cred.ImagePattern,
		})
	}

	disabledRegistriesList := make([]string, 0, len(s.disabledRegistries))
	for registry := range s.disabledRegistries {
		disabledRegistriesList = append(disabledRegistriesList, registry)
	}

	reqPayload := CheckImageUpdatesRequest{
		RegistryCredentials: agentCredentials,
		DisabledRegistries:  disabledRegistriesList,
	}

	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Minute)
	defer cancel()

	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", "/images/check-updates", reqPayload)
	if err != nil {
		s.logger.Error("failed to request image updates from agent",
			zap.Uint("server_id", serverID),
			zap.String("server_name", server.Name),
			zap.Error(err),
		)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		s.logger.Error("agent returned error for image update check",
			zap.Uint("server_id", serverID),
			zap.Int("status_code", resp.StatusCode),
		)
		return
	}

	var agentResp CheckImageUpdatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&agentResp); err != nil {
		s.logger.Error("failed to decode agent response",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return
	}

	var processedResults []ContainerImageCheckResult
	skippedByAgent := 0
	for _, result := range agentResp.Results {
		if result.Error == "" && result.LatestRepoDigest == "" {
			skippedByAgent++
			continue
		}
		processedResults = append(processedResults, result)
	}

	s.processUpdateResults(serverID, processedResults)
	s.cleanupStaleRecords(serverID, processedResults)

	s.logger.Info("completed image update check for server",
		zap.Uint("server_id", serverID),
		zap.Int("total_containers", len(agentResp.Results)),
		zap.Int("checked_containers", len(processedResults)),
		zap.Int("skipped_containers", skippedByAgent),
	)
}

func (s *Service) processUpdateResults(serverID uint, results []ContainerImageCheckResult) {
	now := time.Now()

	for _, result := range results {
		updateAvailable := false
		if result.Error == "" && result.CurrentRepoDigest != "" && result.LatestRepoDigest != "" {
			updateAvailable = result.CurrentRepoDigest != result.LatestRepoDigest
		}
		if result.Error != "" {
			updateAvailable = false
		}

		update := models.ContainerImageUpdate{
			ServerID:          serverID,
			StackName:         result.StackName,
			ContainerName:     result.ContainerName,
			CurrentImageName:  result.ImageName,
			CurrentRepoDigest: result.CurrentRepoDigest,
			LatestRepoDigest:  result.LatestRepoDigest,
			UpdateAvailable:   updateAvailable,
			LastCheckedAt:     &now,
			CheckError:        result.Error,
		}

		var existing models.ContainerImageUpdate
		err := s.db.Where("server_id = ? AND stack_name = ? AND container_name = ?",
			serverID, result.StackName, result.ContainerName).
			First(&existing).Error

		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Error("failed to query existing update record",
				zap.Uint("server_id", serverID),
				zap.String("stack_name", result.StackName),
				zap.String("container_name", result.ContainerName),
				zap.Error(err),
			)
			continue
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := s.db.Create(&update).Error; err != nil {
				s.logger.Error("failed to create image update record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", result.StackName),
					zap.String("container_name", result.ContainerName),
					zap.Error(err),
				)
			} else {
				s.logger.Debug("created image update record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", result.StackName),
					zap.String("container_name", result.ContainerName),
					zap.Bool("update_available", updateAvailable),
				)
			}
		} else {
			if err := s.db.Model(&existing).
				Select("CurrentImageName", "CurrentRepoDigest", "LatestRepoDigest", "UpdateAvailable", "LastCheckedAt", "CheckError").
				Updates(update).Error; err != nil {
				s.logger.Error("failed to update image update record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", result.StackName),
					zap.String("container_name", result.ContainerName),
					zap.Error(err),
				)
			} else {
				s.logger.Debug("updated image update record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", result.StackName),
					zap.String("container_name", result.ContainerName),
					zap.Bool("update_available", updateAvailable),
				)
			}
		}
	}
}

func (s *Service) cleanupStaleRecords(serverID uint, currentResults []ContainerImageCheckResult) {
	currentContainers := make(map[string]bool)
	for _, result := range currentResults {
		key := result.StackName + "|" + result.ContainerName
		currentContainers[key] = true
	}

	var existingRecords []models.ContainerImageUpdate
	if err := s.db.Where("server_id = ?", serverID).Find(&existingRecords).Error; err != nil {
		s.logger.Error("failed to fetch existing records for cleanup",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return
	}

	for _, record := range existingRecords {
		key := record.StackName + "|" + record.ContainerName
		if !currentContainers[key] {
			if err := s.db.Delete(&record).Error; err != nil {
				s.logger.Error("failed to delete stale record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", record.StackName),
					zap.String("container_name", record.ContainerName),
					zap.Error(err),
				)
			} else {
				s.logger.Info("cleaned up stale image update record",
					zap.Uint("server_id", serverID),
					zap.String("stack_name", record.StackName),
					zap.String("container_name", record.ContainerName),
					zap.String("image", record.CurrentImageName),
				)
			}
		}
	}
}

func (s *Service) GetAvailableUpdates() ([]models.ContainerImageUpdate, error) {
	var updates []models.ContainerImageUpdate
	err := s.db.Preload("Server").
		Where("update_available = ?", true).
		Order("last_checked_at DESC").
		Find(&updates).Error

	if err != nil {
		s.logger.Error("failed to fetch available updates", zap.Error(err))
		return nil, err
	}

	s.logger.Debug("fetched available updates", zap.Int("count", len(updates)))
	return updates, nil
}

func (s *Service) GetServerUpdates(serverID uint) ([]models.ContainerImageUpdate, error) {
	var updates []models.ContainerImageUpdate
	err := s.db.Where("server_id = ?", serverID).
		Order("stack_name ASC, container_name ASC").
		Find(&updates).Error

	if err != nil {
		s.logger.Error("failed to fetch server updates",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return nil, err
	}

	enrichedUpdates, err := s.enrichWithLiveDigests(serverID, updates)
	if err != nil {
		s.logger.Warn("failed to enrich updates with live data, returning cached data",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return updates, nil
	}

	s.logger.Debug("fetched and enriched server updates",
		zap.Uint("server_id", serverID),
		zap.Int("count", len(enrichedUpdates)),
	)
	return enrichedUpdates, nil
}

func (s *Service) enrichWithLiveDigests(serverID uint, updates []models.ContainerImageUpdate) ([]models.ContainerImageUpdate, error) {
	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", "/stacks", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.New("agent returned non-200 status")
	}

	var stacksResp struct {
		Stacks []struct {
			Name     string `json:"name"`
			Services []struct {
				Containers []struct {
					Name        string   `json:"name"`
					RepoDigests []string `json:"repo_digests"`
				} `json:"containers"`
			} `json:"services"`
		} `json:"stacks"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&stacksResp); err != nil {
		return nil, err
	}

	liveDigests := make(map[string]string)
	for _, stack := range stacksResp.Stacks {
		for _, service := range stack.Services {
			for _, container := range service.Containers {
				key := stack.Name + "|" + container.Name
				if len(container.RepoDigests) > 0 {
					digest := container.RepoDigests[0]
					if idx := strings.Index(digest, "@"); idx != -1 {
						liveDigests[key] = digest[idx+1:]
					}
				}
			}
		}
	}

	enriched := make([]models.ContainerImageUpdate, 0)
	for _, update := range updates {
		key := update.StackName + "|" + update.ContainerName
		if liveDigest, found := liveDigests[key]; found {
			update.CurrentRepoDigest = liveDigest
			update.UpdateAvailable = (liveDigest != update.LatestRepoDigest) && update.LatestRepoDigest != ""

			s.logger.Debug("enriched update with live digest",
				zap.String("stack", update.StackName),
				zap.String("container", update.ContainerName),
				zap.String("live_digest", liveDigest),
				zap.String("latest_digest", update.LatestRepoDigest),
				zap.Bool("update_available", update.UpdateAvailable),
			)
		}
		if update.UpdateAvailable || update.CheckError != "" {
			enriched = append(enriched, update)
		}
	}

	return enriched, nil
}

func (s *Service) Shutdown() {
	s.logger.Info("shutting down image updates service")
	s.cancel()
}

type AgentRegistryCredential struct {
	Registry     string `json:"registry"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	StackPattern string `json:"stack_pattern"`
	ImagePattern string `json:"image_pattern"`
}

type CheckImageUpdatesRequest struct {
	RegistryCredentials []AgentRegistryCredential `json:"registry_credentials,omitempty"`
	DisabledRegistries  []string                  `json:"disabled_registries,omitempty"`
}

type ContainerImageCheckResult struct {
	StackName         string `json:"stack_name"`
	ContainerName     string `json:"container_name"`
	ImageName         string `json:"image_name"`
	CurrentRepoDigest string `json:"current_repo_digest"`
	LatestRepoDigest  string `json:"latest_repo_digest"`
	Error             string `json:"error,omitempty"`
}

type CheckImageUpdatesResponse struct {
	Results []ContainerImageCheckResult `json:"results"`
}
