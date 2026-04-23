package tokens

import (
	"context"
	"fmt"
	"sync"
	"time"

	"berth/internal/pkg/config"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	cfg    *config.Config
	db     *gorm.DB
	logger *zap.Logger

	mu             sync.RWMutex
	revokedJTIs    map[string]time.Time
	revokePersist  bool
	revokeEnabled  bool
	cleanupStop    chan struct{}
	cleanupStopped chan struct{}
}

func NewService(lc fx.Lifecycle, cfg *config.Config, db *gorm.DB, logger *zap.Logger) (*Service, error) {
	s := &Service{
		cfg:           cfg,
		db:            db,
		logger:        logger,
		revokedJTIs:   make(map[string]time.Time),
		revokeEnabled: cfg.Revocation.Enabled,
		revokePersist: cfg.Revocation.Enabled && db != nil,
	}

	if s.revokePersist {
		if err := db.AutoMigrate(&RevokedToken{}); err != nil {
			logger.Warn("revoked_tokens automigrate failed; falling back to memory-only revocation", zap.Error(err))
			s.revokePersist = false
		}
	}

	if lc != nil {
		lc.Append(fx.Hook{
			OnStart: func(context.Context) error {
				if s.revokePersist {
					if err := s.loadRevokedFromDB(); err != nil {
						return fmt.Errorf("load revoked tokens: %w", err)
					}
				}
				s.startCleanupWorker()
				return nil
			},
			OnStop: func(context.Context) error {
				s.stopCleanupWorker()
				if s.revokePersist {
					if err := s.saveRevokedToDB(); err != nil {
						logger.Error("failed to persist revoked tokens on shutdown", zap.Error(err))
					}
				}
				return nil
			},
		})
	}

	return s, nil
}

func (s *Service) GetAccessExpirySeconds() int {
	return int(s.cfg.JWT.AccessExpiry.Seconds())
}

func (s *Service) startCleanupWorker() {
	s.cleanupStop = make(chan struct{})
	s.cleanupStopped = make(chan struct{})

	go func() {
		defer close(s.cleanupStopped)

		revokeTicker := time.NewTicker(s.cfg.Revocation.CleanupPeriod)
		refreshTicker := time.NewTicker(s.cfg.RefreshToken.CleanupInterval)
		defer revokeTicker.Stop()
		defer refreshTicker.Stop()

		for {
			select {
			case <-revokeTicker.C:
				s.cleanupExpiredJTIs()
			case <-refreshTicker.C:
				if err := s.cleanupExpiredRefreshTokens(); err != nil {
					s.logger.Error("refresh token cleanup failed", zap.Error(err))
				}
			case <-s.cleanupStop:
				return
			}
		}
	}()
}

func (s *Service) stopCleanupWorker() {
	if s.cleanupStop == nil {
		return
	}
	close(s.cleanupStop)
	<-s.cleanupStopped
}

var Module = fx.Module("tokens",
	fx.Provide(NewService),
)
