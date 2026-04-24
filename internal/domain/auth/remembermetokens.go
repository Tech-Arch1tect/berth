package auth

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

func (s *Service) CreateRememberMeToken(userID uint) (*RememberMeToken, error) {
	if !s.config.Auth.RememberMeEnabled {
		return nil, ErrRememberMeDisabled
	}

	s.db.Where("user_id = ?", userID).Delete(&RememberMeToken{})

	token, err := generateHexToken(s.config.Auth.RememberMeTokenLength)
	if err != nil {
		return nil, err
	}

	row := &RememberMeToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().Add(s.config.Auth.RememberMeExpiry),
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, fmt.Errorf("create remember-me token: %w", err)
	}
	return row, nil
}

func (s *Service) ValidateRememberMeToken(token string) (*RememberMeToken, error) {
	if !s.config.Auth.RememberMeEnabled {
		return nil, ErrRememberMeDisabled
	}

	var row RememberMeToken
	if err := s.db.Where("token = ?", token).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRememberMeTokenInvalid
		}
		return nil, fmt.Errorf("validate remember-me token: %w", err)
	}
	if row.Used {
		return nil, ErrRememberMeTokenUsed
	}
	if time.Now().After(row.ExpiresAt) {
		return nil, ErrRememberMeTokenExpired
	}
	return &row, nil
}

func (s *Service) IsRememberMeEnabled() bool {
	return s.config.Auth.RememberMeEnabled
}

func (s *Service) InvalidateRememberMeTokens(userID uint) error {
	if !s.config.Auth.RememberMeEnabled {
		return ErrRememberMeDisabled
	}
	if err := s.db.Where("user_id = ?", userID).Delete(&RememberMeToken{}).Error; err != nil {
		return fmt.Errorf("invalidate remember-me tokens: %w", err)
	}
	return nil
}

func (s *Service) GetRememberMeExpiry() time.Duration  { return s.config.Auth.RememberMeExpiry }
func (s *Service) GetRememberMeCookieSecure() bool     { return s.config.Auth.RememberMeCookieSecure }
func (s *Service) GetRememberMeCookieSameSite() string { return s.config.Auth.RememberMeCookieSameSite }
func (s *Service) ShouldRotateRememberMeToken() bool   { return s.config.Auth.RememberMeRotateOnUse }

func (s *Service) RotateRememberMeToken(oldToken string) (*RememberMeToken, error) {
	if !s.config.Auth.RememberMeEnabled {
		return nil, ErrRememberMeDisabled
	}
	old, err := s.ValidateRememberMeToken(oldToken)
	if err != nil {
		return nil, err
	}
	fresh, err := s.CreateRememberMeToken(old.UserID)
	if err != nil {
		return nil, err
	}
	if err := s.db.Delete(old).Error; err != nil {
		return nil, fmt.Errorf("delete old remember-me token: %w", err)
	}
	return fresh, nil
}
