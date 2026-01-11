package vulnscan

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	db        *gorm.DB
	serverSvc *server.Service
	agentSvc  *agent.Service
	rbacSvc   *rbac.Service
	logger    *logging.Service
}

func NewService(db *gorm.DB, serverSvc *server.Service, agentSvc *agent.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
	return &Service{
		db:        db,
		serverSvc: serverSvc,
		agentSvc:  agentSvc,
		rbacSvc:   rbacSvc,
		logger:    logger,
	}
}

type AgentScanResponse struct {
	ID            string             `json:"id"`
	StackName     string             `json:"stack_name"`
	Status        string             `json:"status"`
	TotalImages   int                `json:"total_images"`
	ScannedImages int                `json:"scanned_images"`
	StartedAt     time.Time          `json:"started_at"`
	CompletedAt   *time.Time         `json:"completed_at,omitempty"`
	Error         string             `json:"error,omitempty"`
	Results       []AgentImageResult `json:"results,omitempty"`
}

type AgentImageResult struct {
	ImageName       string               `json:"image_name"`
	Status          string               `json:"status"`
	Error           string               `json:"error,omitempty"`
	Vulnerabilities []AgentVulnerability `json:"vulnerabilities,omitempty"`
	ScannedAt       time.Time            `json:"scanned_at"`
}

type AgentVulnerability struct {
	ID               string  `json:"id"`
	Severity         string  `json:"severity"`
	Package          string  `json:"package"`
	InstalledVersion string  `json:"installed_version"`
	FixedVersion     string  `json:"fixed_version,omitempty"`
	Description      string  `json:"description,omitempty"`
	DataSource       string  `json:"data_source,omitempty"`
	CVSS             float64 `json:"cvss,omitempty"`
}

func (s *Service) StartScan(ctx context.Context, userID, serverID uint, stackName string) (*models.ImageScan, error) {
	s.logger.Info("starting vulnerability scan",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackName, "stacks.read")
	if err != nil {
		s.logger.Error("failed to check permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("permission denied: stacks.read required")
	}

	srv, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	var existingScan models.ImageScan
	err = s.db.Where("server_id = ? AND stack_name = ? AND status IN ?",
		serverID, stackName, []string{models.ScanStatusPending, models.ScanStatusRunning}).
		First(&existingScan).Error

	if err == nil {
		s.logger.Info("returning existing active scan",
			zap.Uint("scan_id", existingScan.ID),
			zap.String("status", existingScan.Status),
		)
		return &existingScan, nil
	}

	scan := &models.ImageScan{
		ServerID:  serverID,
		StackName: stackName,
		Status:    models.ScanStatusPending,
		StartedAt: time.Now(),
	}

	if err := s.db.Create(scan).Error; err != nil {
		s.logger.Error("failed to create scan record",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return nil, fmt.Errorf("failed to create scan record: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/scan", stackName)
	resp, err := s.agentSvc.MakeRequest(ctx, srv, http.MethodPost, endpoint, nil)
	if err != nil {
		s.markScanFailed(scan, fmt.Sprintf("failed to contact agent: %v", err))
		return scan, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		s.markScanFailed(scan, fmt.Sprintf("agent returned status %d: %s", resp.StatusCode, string(body)))
		return scan, nil
	}

	var agentResp AgentScanResponse
	if err := json.NewDecoder(resp.Body).Decode(&agentResp); err != nil {
		s.markScanFailed(scan, fmt.Sprintf("failed to parse agent response: %v", err))
		return scan, nil
	}

	scan.AgentScanID = agentResp.ID
	scan.Status = models.ScanStatusRunning
	scan.TotalImages = agentResp.TotalImages

	if err := s.db.Save(scan).Error; err != nil {
		s.logger.Error("failed to update scan with agent ID",
			zap.Error(err),
			zap.Uint("scan_id", scan.ID),
			zap.String("agent_scan_id", agentResp.ID),
		)
	}

	s.logger.Info("vulnerability scan started successfully",
		zap.Uint("scan_id", scan.ID),
		zap.String("agent_scan_id", agentResp.ID),
		zap.Int("total_images", agentResp.TotalImages),
	)

	return scan, nil
}

func (s *Service) markScanFailed(scan *models.ImageScan, errorMsg string) {
	s.logger.Error("marking scan as failed",
		zap.Uint("scan_id", scan.ID),
		zap.String("error", errorMsg),
	)

	now := time.Now()
	scan.Status = models.ScanStatusFailed
	scan.ErrorMessage = errorMsg
	scan.CompletedAt = &now

	if err := s.db.Save(scan).Error; err != nil {
		s.logger.Error("failed to update scan status to failed",
			zap.Error(err),
			zap.Uint("scan_id", scan.ID),
		)
	}
}

func (s *Service) GetScan(ctx context.Context, userID, scanID uint) (*models.ImageScan, error) {
	var scan models.ImageScan
	if err := s.db.Preload("Vulnerabilities").First(&scan, scanID).Error; err != nil {
		return nil, err
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, scan.ServerID, scan.StackName, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("permission denied: stacks.read required")
	}

	return &scan, nil
}

type ScanWithSummary struct {
	Scan    models.ImageScan      `json:"scan"`
	Summary *VulnerabilitySummary `json:"summary,omitempty"`
}

func (s *Service) GetScansForStack(ctx context.Context, userID, serverID uint, stackName string) ([]models.ImageScan, error) {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackName, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("permission denied: stacks.read required")
	}

	var scans []models.ImageScan
	if err := s.db.Where("server_id = ? AND stack_name = ?", serverID, stackName).
		Order("created_at DESC").
		Find(&scans).Error; err != nil {
		return nil, err
	}
	return scans, nil
}

func (s *Service) GetScansForStackWithSummaries(ctx context.Context, userID, serverID uint, stackName string) ([]ScanWithSummary, error) {
	scans, err := s.GetScansForStack(ctx, userID, serverID, stackName)
	if err != nil {
		return nil, err
	}

	result := make([]ScanWithSummary, len(scans))
	for i, scan := range scans {
		result[i].Scan = scan
		if scan.Status == models.ScanStatusCompleted {
			summary, err := s.GetVulnerabilitySummary(scan.ID)
			if err == nil {
				result[i].Summary = summary
			}
		}
	}

	return result, nil
}

func (s *Service) PollScan(ctx context.Context, scan *models.ImageScan) error {
	if scan.IsTerminal() {
		return nil
	}

	srv, err := s.serverSvc.GetServer(scan.ServerID)
	if err != nil {
		s.recordPollFailure(scan, fmt.Sprintf("failed to get server: %v", err))
		return err
	}

	endpoint := fmt.Sprintf("/scans/%s", scan.AgentScanID)
	resp, err := s.agentSvc.MakeRequest(ctx, srv, http.MethodGet, endpoint, nil)
	if err != nil {
		s.recordPollFailure(scan, fmt.Sprintf("failed to contact agent: %v", err))
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		errMsg := fmt.Sprintf("agent returned status %d: %s", resp.StatusCode, string(body))
		s.recordPollFailure(scan, errMsg)
		return fmt.Errorf("poll failed: %s", errMsg)
	}

	var agentResp AgentScanResponse
	if err := json.NewDecoder(resp.Body).Decode(&agentResp); err != nil {
		s.recordPollFailure(scan, fmt.Sprintf("failed to parse agent response: %v", err))
		return err
	}

	now := time.Now()
	scan.LastPolledAt = &now
	scan.PollFailures = 0
	scan.LastPollError = ""
	scan.ScannedImages = agentResp.ScannedImages

	if agentResp.Status == "completed" || agentResp.Status == "failed" {
		scan.Status = agentResp.Status
		scan.CompletedAt = agentResp.CompletedAt
		scan.ErrorMessage = agentResp.Error

		if agentResp.Status == "completed" {
			if err := s.storeVulnerabilities(scan, agentResp.Results); err != nil {
				s.logger.Error("failed to store vulnerabilities",
					zap.Error(err),
					zap.Uint("scan_id", scan.ID),
				)
			}
		}
	}

	if err := s.db.Save(scan).Error; err != nil {
		s.logger.Error("failed to save scan after poll",
			zap.Error(err),
			zap.Uint("scan_id", scan.ID),
		)
		return err
	}

	return nil
}

func (s *Service) recordPollFailure(scan *models.ImageScan, errMsg string) {
	now := time.Now()
	scan.LastPolledAt = &now
	scan.PollFailures++
	scan.LastPollError = errMsg

	if err := s.db.Save(scan).Error; err != nil {
		s.logger.Error("failed to record poll failure",
			zap.Error(err),
			zap.Uint("scan_id", scan.ID),
		)
	}
}

func (s *Service) storeVulnerabilities(scan *models.ImageScan, results []AgentImageResult) error {
	var vulns []models.ImageVulnerability

	for _, result := range results {
		for _, v := range result.Vulnerabilities {
			vulns = append(vulns, models.ImageVulnerability{
				ScanID:           scan.ID,
				ImageName:        result.ImageName,
				VulnerabilityID:  v.ID,
				Severity:         v.Severity,
				Package:          v.Package,
				InstalledVersion: v.InstalledVersion,
				FixedVersion:     v.FixedVersion,
				Description:      v.Description,
				DataSource:       v.DataSource,
				CVSS:             v.CVSS,
			})
		}
	}

	if len(vulns) == 0 {
		return nil
	}

	if err := s.db.CreateInBatches(vulns, 100).Error; err != nil {
		return fmt.Errorf("failed to store vulnerabilities: %w", err)
	}

	s.logger.Info("stored vulnerabilities",
		zap.Uint("scan_id", scan.ID),
		zap.Int("count", len(vulns)),
	)

	return nil
}

func (s *Service) CleanupStaleScans() error {
	now := time.Now()
	staleThreshold := now.Add(-1 * time.Hour)
	maxPollFailures := 10

	var staleScans []models.ImageScan
	if err := s.db.Where("status IN ? AND started_at < ?",
		[]string{models.ScanStatusPending, models.ScanStatusRunning},
		staleThreshold).
		Find(&staleScans).Error; err != nil {
		return fmt.Errorf("failed to query stale scans: %w", err)
	}

	for i := range staleScans {
		scan := &staleScans[i]
		scan.Status = models.ScanStatusTimeout
		scan.ErrorMessage = "scan timed out after 1 hour"
		scan.CompletedAt = &now

		if err := s.db.Save(scan).Error; err != nil {
			s.logger.Error("failed to mark scan as timed out",
				zap.Error(err),
				zap.Uint("scan_id", scan.ID),
			)
			continue
		}

		s.logger.Info("marked stale scan as timed out",
			zap.Uint("scan_id", scan.ID),
			zap.String("stack_name", scan.StackName),
		)
	}

	var failedPollingScans []models.ImageScan
	if err := s.db.Where("status IN ? AND poll_failures >= ?",
		[]string{models.ScanStatusPending, models.ScanStatusRunning},
		maxPollFailures).
		Find(&failedPollingScans).Error; err != nil {
		return fmt.Errorf("failed to query failed polling scans: %w", err)
	}

	for i := range failedPollingScans {
		scan := &failedPollingScans[i]
		scan.Status = models.ScanStatusFailed
		scan.ErrorMessage = fmt.Sprintf("exceeded maximum poll failures (%d)", maxPollFailures)
		scan.CompletedAt = &now

		if err := s.db.Save(scan).Error; err != nil {
			s.logger.Error("failed to mark scan as failed due to poll failures",
				zap.Error(err),
				zap.Uint("scan_id", scan.ID),
			)
			continue
		}

		s.logger.Info("marked scan as failed due to poll failures",
			zap.Uint("scan_id", scan.ID),
			zap.String("stack_name", scan.StackName),
			zap.Int("poll_failures", scan.PollFailures),
		)
	}

	return nil
}

func (s *Service) GetLatestScanForStack(ctx context.Context, userID, serverID uint, stackName string) (*models.ImageScan, error) {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackName, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("permission denied: stacks.read required")
	}

	var scan models.ImageScan
	if err := s.db.Preload("Vulnerabilities").
		Where("server_id = ? AND stack_name = ?", serverID, stackName).
		Order("created_at DESC").
		First(&scan).Error; err != nil {
		return nil, err
	}
	return &scan, nil
}

type VulnerabilitySummary struct {
	Critical   int `json:"critical"`
	High       int `json:"high"`
	Medium     int `json:"medium"`
	Low        int `json:"low"`
	Negligible int `json:"negligible"`
	Unknown    int `json:"unknown"`
	Total      int `json:"total"`
}

type ScanComparison struct {
	BaseScan       *models.ImageScan           `json:"base_scan"`
	CompareScan    *models.ImageScan           `json:"compare_scan"`
	NewVulns       []models.ImageVulnerability `json:"new_vulnerabilities"`
	FixedVulns     []models.ImageVulnerability `json:"fixed_vulnerabilities"`
	UnchangedCount int                         `json:"unchanged_count"`
}

func (s *Service) CompareScans(ctx context.Context, userID, baseScanID, compareScanID uint) (*ScanComparison, error) {
	baseScan, err := s.GetScan(ctx, userID, baseScanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get base scan: %w", err)
	}

	compareScan, err := s.GetScan(ctx, userID, compareScanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get compare scan: %w", err)
	}

	if baseScan.ServerID != compareScan.ServerID || baseScan.StackName != compareScan.StackName {
		return nil, fmt.Errorf("scans must be from the same stack")
	}

	baseVulnMap := make(map[string]models.ImageVulnerability)
	for _, v := range baseScan.Vulnerabilities {
		key := fmt.Sprintf("%s|%s|%s", v.VulnerabilityID, v.ImageName, v.Package)
		baseVulnMap[key] = v
	}

	compareVulnMap := make(map[string]models.ImageVulnerability)
	for _, v := range compareScan.Vulnerabilities {
		key := fmt.Sprintf("%s|%s|%s", v.VulnerabilityID, v.ImageName, v.Package)
		compareVulnMap[key] = v
	}

	var newVulns []models.ImageVulnerability
	var fixedVulns []models.ImageVulnerability
	unchangedCount := 0

	for key, v := range compareVulnMap {
		if _, exists := baseVulnMap[key]; !exists {
			newVulns = append(newVulns, v)
		} else {
			unchangedCount++
		}
	}

	for key, v := range baseVulnMap {
		if _, exists := compareVulnMap[key]; !exists {
			fixedVulns = append(fixedVulns, v)
		}
	}

	return &ScanComparison{
		BaseScan:       baseScan,
		CompareScan:    compareScan,
		NewVulns:       newVulns,
		FixedVulns:     fixedVulns,
		UnchangedCount: unchangedCount,
	}, nil
}

type ScanTrendPoint struct {
	ScanID  uint                  `json:"scan_id"`
	Date    time.Time             `json:"date"`
	Summary *VulnerabilitySummary `json:"summary"`
}

func (s *Service) GetScanTrend(ctx context.Context, userID, serverID uint, stackName string, limit int) ([]ScanTrendPoint, error) {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackName, "stacks.read")
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("permission denied: stacks.read required")
	}

	if limit <= 0 || limit > 50 {
		limit = 10
	}

	var scans []models.ImageScan
	if err := s.db.Where("server_id = ? AND stack_name = ? AND status = ?", serverID, stackName, models.ScanStatusCompleted).
		Order("started_at DESC").
		Limit(limit).
		Find(&scans).Error; err != nil {
		return nil, err
	}

	trendPoints := make([]ScanTrendPoint, 0, len(scans))
	for i := len(scans) - 1; i >= 0; i-- {
		scan := scans[i]
		summary, err := s.GetVulnerabilitySummary(scan.ID)
		if err != nil {
			continue
		}
		trendPoints = append(trendPoints, ScanTrendPoint{
			ScanID:  scan.ID,
			Date:    scan.StartedAt,
			Summary: summary,
		})
	}

	return trendPoints, nil
}

func (s *Service) GetVulnerabilitySummary(scanID uint) (*VulnerabilitySummary, error) {
	var results []struct {
		Severity string
		Count    int
	}

	if err := s.db.Model(&models.ImageVulnerability{}).
		Select("severity, COUNT(*) as count").
		Where("scan_id = ?", scanID).
		Group("severity").
		Scan(&results).Error; err != nil {
		return nil, err
	}

	summary := &VulnerabilitySummary{}
	for _, r := range results {
		switch r.Severity {
		case models.VulnSeverityCritical:
			summary.Critical = r.Count
		case models.VulnSeverityHigh:
			summary.High = r.Count
		case models.VulnSeverityMedium:
			summary.Medium = r.Count
		case models.VulnSeverityLow:
			summary.Low = r.Count
		case models.VulnSeverityNegligible:
			summary.Negligible = r.Count
		default:
			summary.Unknown += r.Count
		}
		summary.Total += r.Count
	}

	return summary, nil
}
