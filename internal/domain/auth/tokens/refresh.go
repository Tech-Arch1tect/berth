package tokens

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"berth/models"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (s *Service) IssueRefresh(userID uint, info SessionInfo) (*RefreshTokenData, error) {
	plaintext, err := s.generateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}
	hash := s.hashRefresh(plaintext)
	expiresAt := time.Now().Add(s.cfg.RefreshToken.Expiry)

	deviceInfoJSON := ""
	if info.DeviceInfo != nil {
		if b, err := json.Marshal(info.DeviceInfo); err == nil {
			deviceInfoJSON = string(b)
		}
	}

	row := models.RefreshToken{
		UserID:     userID,
		TokenHash:  hash,
		ExpiresAt:  expiresAt,
		CreatedAt:  time.Now(),
		LastUsed:   time.Now(),
		DeviceInfo: deviceInfoJSON,
	}
	if err := s.db.Create(&row).Error; err != nil {
		s.logger.Error("store refresh token failed", zap.Error(err), zap.Uint("user_id", userID))
		return nil, fmt.Errorf("store refresh token: %w", err)
	}
	return &RefreshTokenData{
		Token:     plaintext,
		TokenID:   row.ID,
		Hash:      hash,
		ExpiresAt: expiresAt,
	}, nil
}

func (s *Service) ValidateRefresh(tokenString string) (*models.RefreshToken, error) {
	hash := s.hashRefresh(tokenString)

	var row models.RefreshToken
	err := s.db.Where("token_hash = ?", hash).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRefreshNotFound
		}
		return nil, fmt.Errorf("refresh token lookup: %w", err)
	}

	if time.Now().After(row.ExpiresAt) {
		s.db.Delete(&row)
		return nil, ErrRefreshExpired
	}
	return &row, nil
}

func (s *Service) RotateRefresh(tokenString string) (*RotationResult, error) {
	oldToken, err := s.ValidateRefresh(tokenString)
	if err != nil {
		return nil, err
	}

	newAccess, err := s.IssueAccessToken(oldToken.UserID)
	if err != nil {
		return nil, fmt.Errorf("mint access on rotate: %w", err)
	}

	info := SessionInfo{}
	if oldToken.DeviceInfo != "" {
		var device map[string]any
		if err := json.Unmarshal([]byte(oldToken.DeviceInfo), &device); err == nil {
			info.DeviceInfo = device
		}
	}

	newRefresh, err := s.IssueRefresh(oldToken.UserID, info)
	if err != nil {
		return nil, fmt.Errorf("mint refresh on rotate: %w", err)
	}

	if err := s.db.Delete(oldToken).Error; err != nil {
		s.logger.Warn("delete old refresh on rotate failed", zap.Uint("token_id", oldToken.ID), zap.Error(err))
	}

	return &RotationResult{
		AccessToken:    newAccess,
		RefreshToken:   newRefresh.Token,
		RefreshTokenID: newRefresh.TokenID,
		OldTokenID:     oldToken.ID,
		ExpiresAt:      newRefresh.ExpiresAt,
	}, nil
}

func (s *Service) RevokeRefresh(tokenString string) error {
	hash := s.hashRefresh(tokenString)
	if err := s.db.Where("token_hash = ?", hash).Delete(&models.RefreshToken{}).Error; err != nil {
		return fmt.Errorf("revoke refresh: %w", err)
	}
	return nil
}

func (s *Service) RevokeRefreshTokenByID(id uint) error {
	if err := s.db.Where("id = ?", id).Delete(&models.RefreshToken{}).Error; err != nil {
		return fmt.Errorf("revoke refresh by id: %w", err)
	}
	return nil
}

func (s *Service) cleanupExpiredRefreshTokens() error {
	now := time.Now()

	var expiredIDs []uint
	if err := s.db.Model(&models.RefreshToken{}).
		Where("expires_at < ?", now).
		Pluck("id", &expiredIDs).Error; err != nil {
		return fmt.Errorf("pluck expired refresh ids: %w", err)
	}

	if err := s.db.Where("expires_at < ?", now).Delete(&models.RefreshToken{}).Error; err != nil {
		return fmt.Errorf("delete expired refresh: %w", err)
	}

	if len(expiredIDs) > 0 {
		if err := s.db.Exec("DELETE FROM user_sessions WHERE refresh_token_id IN ?", expiredIDs).Error; err != nil {
			s.logger.Warn("clean user_sessions tied to expired refresh failed", zap.Error(err))
		}
	}
	return nil
}

func (s *Service) generateSecureToken() (string, error) {
	b := make([]byte, s.cfg.RefreshToken.TokenLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) hashRefresh(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
