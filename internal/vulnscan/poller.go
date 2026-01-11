package vulnscan

import (
	"berth/models"
	"context"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Poller struct {
	db       *gorm.DB
	service  *Service
	logger   *logging.Service
	interval time.Duration
	ctx      context.Context
	cancel   context.CancelFunc
}

func NewPoller(db *gorm.DB, service *Service, logger *logging.Service) *Poller {
	ctx, cancel := context.WithCancel(context.Background())

	return &Poller{
		db:       db,
		service:  service,
		logger:   logger,
		interval: 10 * time.Second,
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (p *Poller) Start() {
	p.logger.Info("starting vulnerability scan poller",
		zap.Duration("interval", p.interval),
	)

	go p.pollLoop()
}

func (p *Poller) Stop() {
	p.logger.Info("stopping vulnerability scan poller")
	p.cancel()
}

func (p *Poller) pollLoop() {
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.pollActiveScans()
		case <-p.ctx.Done():
			p.logger.Info("vulnerability scan poller stopped")
			return
		}
	}
}

func (p *Poller) pollActiveScans() {
	if err := p.service.CleanupStaleScans(); err != nil {
		p.logger.Error("failed to cleanup stale scans", zap.Error(err))
	}

	var scans []models.ImageScan
	if err := p.db.Where("status IN ?", []string{models.ScanStatusPending, models.ScanStatusRunning}).
		Find(&scans).Error; err != nil {
		p.logger.Error("failed to query active scans", zap.Error(err))
		return
	}

	if len(scans) == 0 {
		return
	}

	p.logger.Debug("polling active scans", zap.Int("count", len(scans)))

	for i := range scans {
		scan := &scans[i]

		if scan.AgentScanID == "" {
			continue
		}

		if err := p.service.PollScan(p.ctx, scan); err != nil {
			p.logger.Debug("poll failed for scan",
				zap.Uint("scan_id", scan.ID),
				zap.Error(err),
			)
		}
	}
}
