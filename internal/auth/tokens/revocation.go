package tokens

import (
	"time"

	"go.uber.org/zap"
)

func (s *Service) RevokeToken(jti string, expiresAt time.Time) error {
	if !s.revokeEnabled {
		return nil
	}

	s.mu.Lock()
	s.revokedJTIs[jti] = expiresAt
	s.mu.Unlock()

	if s.revokePersist {
		if err := s.db.Create(&RevokedToken{JTI: jti, ExpiresAt: expiresAt}).Error; err != nil {
			s.logger.Error("persist revoked JTI failed", zap.String("jti", jti), zap.Error(err))
			return err
		}
	}
	return nil
}

func (s *Service) isJTIRevoked(jti string) (bool, error) {
	s.mu.RLock()
	expiresAt, exists := s.revokedJTIs[jti]
	s.mu.RUnlock()

	if !exists {
		return false, nil
	}
	if time.Now().After(expiresAt) {
		s.mu.Lock()
		delete(s.revokedJTIs, jti)
		s.mu.Unlock()
		return false, nil
	}
	return true, nil
}

func (s *Service) cleanupExpiredJTIs() {
	now := time.Now()

	s.mu.Lock()
	for jti, expiresAt := range s.revokedJTIs {
		if now.After(expiresAt) {
			delete(s.revokedJTIs, jti)
		}
	}
	s.mu.Unlock()
}

func (s *Service) loadRevokedFromDB() error {
	now := time.Now()

	var rows []RevokedToken
	if err := s.db.Where("expires_at > ?", now).Find(&rows).Error; err != nil {
		return err
	}

	s.mu.Lock()
	for _, r := range rows {
		s.revokedJTIs[r.JTI] = r.ExpiresAt
	}
	s.mu.Unlock()

	if err := s.db.Unscoped().Where("expires_at <= ?", now).Delete(&RevokedToken{}).Error; err != nil {
		s.logger.Warn("clean expired revoked rows on load failed", zap.Error(err))
	}
	return nil
}

func (s *Service) saveRevokedToDB() error {
	now := time.Now()

	s.mu.RLock()
	rows := make([]RevokedToken, 0, len(s.revokedJTIs))
	for jti, expiresAt := range s.revokedJTIs {
		if now.Before(expiresAt) {
			rows = append(rows, RevokedToken{JTI: jti, ExpiresAt: expiresAt})
		}
	}
	s.mu.RUnlock()

	tx := s.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Unscoped().Where("1=1").Delete(&RevokedToken{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	for i := range rows {
		if err := tx.Create(&rows[i]).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}
