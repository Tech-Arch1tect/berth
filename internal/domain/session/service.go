package session

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"berth/internal/domain/auth/tokens"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	tokens *tokens.Service
	logger *zap.Logger
}

func ProvideSessionService(db *gorm.DB, t *tokens.Service, logger *zap.Logger) *Service {
	if db == nil {
		return nil
	}
	return &Service{db: db, tokens: t, logger: logger}
}

func (s *Service) TrackSession(userID uint, token string, sessionType SessionType, ipAddress, userAgent string, expiresAt time.Time) error {
	session := UserSession{
		UserID:    userID,
		Token:     token,
		Type:      sessionType,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		ExpiresAt: expiresAt,
	}
	if err := s.db.Create(&session).Error; err != nil {
		s.logger.Error("failed to track session", zap.Error(err), zap.Uint("user_id", userID))
		return err
	}
	return nil
}

func (s *Service) TrackJWTSessionWithRefreshToken(userID uint, accessJTI string, refreshTokenID uint, ipAddress, userAgent string, expiresAt time.Time) error {
	session := UserSession{
		UserID:         userID,
		Token:          s.generateSessionTokenFromID(refreshTokenID),
		Type:           SessionTypeJWT,
		AccessTokenJTI: accessJTI,
		RefreshTokenID: refreshTokenID,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		CreatedAt:      time.Now(),
		LastUsed:       time.Now(),
		ExpiresAt:      expiresAt,
	}
	if err := s.db.Create(&session).Error; err != nil {
		s.logger.Error("failed to track JWT session", zap.Error(err), zap.Uint("user_id", userID))
		return err
	}
	return nil
}

func (s *Service) UpdateJWTSessionWithRefreshToken(oldRefreshTokenID uint, newAccessJTI string, newRefreshTokenID uint, expiresAt time.Time) error {
	return s.db.Model(&UserSession{}).
		Where("refresh_token_id = ? AND type = ?", oldRefreshTokenID, SessionTypeJWT).
		Updates(map[string]any{
			"token":            s.generateSessionTokenFromID(newRefreshTokenID),
			"access_token_jti": newAccessJTI,
			"refresh_token_id": newRefreshTokenID,
			"expires_at":       expiresAt,
			"last_used":        time.Now(),
		}).Error
}

func (s *Service) generateSessionTokenFromID(refreshTokenID uint) string {
	hash := sha256.Sum256(fmt.Appendf(nil, "refresh_token_id_%d", refreshTokenID))
	return hex.EncodeToString(hash[:])
}

func (s *Service) UpdateLastUsed(token string) error {
	err := s.db.Model(&UserSession{}).Where("token = ?", token).Update("last_used", time.Now()).Error
	if err != nil {
		s.logger.Warn("failed to update session last_used", zap.Error(err))
	}
	return err
}

func (s *Service) GetCurrentSessionToken(userID uint, accessJTI string) (string, error) {
	var session UserSession
	if err := s.db.Where("user_id = ? AND access_token_jti = ?", userID, accessJTI).
		First(&session).Error; err != nil {
		return "", err
	}
	return session.Token, nil
}

func (s *Service) GetUserSessions(userID uint, currentToken string) ([]UserSession, error) {
	var sessions []UserSession
	if err := s.db.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Order("last_used DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	for i := range sessions {
		if sessions[i].Token == currentToken {
			sessions[i].Current = true
		}
	}
	return sessions, nil
}

func (s *Service) revokeTokens(session *UserSession) {
	if session.Type != SessionTypeJWT || s.tokens == nil {
		return
	}
	if session.AccessTokenJTI != "" {
		_ = s.tokens.RevokeToken(session.AccessTokenJTI, session.ExpiresAt)
	}
	if session.RefreshTokenID != 0 {
		_ = s.tokens.RevokeRefreshTokenByID(session.RefreshTokenID)
	}
}

func (s *Service) RevokeSession(userID uint, sessionID uint) error {
	var session UserSession
	if err := s.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return err
	}
	s.revokeTokens(&session)
	if err := s.db.Delete(&session).Error; err != nil {
		s.logger.Error("failed to delete session from db", zap.Error(err), zap.Uint("session_id", sessionID))
		return err
	}
	return nil
}

func (s *Service) RevokeAllOtherSessions(userID uint, currentToken string) error {
	var sessions []UserSession
	if err := s.db.Where("user_id = ? AND token != ?", userID, currentToken).Find(&sessions).Error; err != nil {
		return err
	}
	for i := range sessions {
		s.revokeTokens(&sessions[i])
	}
	return s.db.Where("user_id = ? AND token != ?", userID, currentToken).Delete(&UserSession{}).Error
}

func (s *Service) RevokeAllUserSessions(userID uint) error {
	var sessions []UserSession
	if err := s.db.Where("user_id = ?", userID).Find(&sessions).Error; err != nil {
		return err
	}
	for i := range sessions {
		s.revokeTokens(&sessions[i])
	}
	return s.db.Where("user_id = ?", userID).Delete(&UserSession{}).Error
}

func (s *Service) SessionExists(token string) (bool, error) {
	var count int64
	if err := s.db.Model(&UserSession{}).
		Where("token = ? AND expires_at > ?", token, time.Now()).
		Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		_ = s.UpdateLastUsed(token)
		return true, nil
	}
	return false, nil
}

func (s *Service) RemoveSessionByToken(token string) error {
	return s.db.Where("token = ?", token).Delete(&UserSession{}).Error
}
