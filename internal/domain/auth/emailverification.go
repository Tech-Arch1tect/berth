package auth

import (
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (s *Service) createEmailVerificationToken(email string) (*EmailVerificationToken, error) {
	if !s.config.Auth.EmailVerificationEnabled {
		return nil, ErrEmailVerificationDisabled
	}

	now := time.Now()
	if err := s.db.Model(&EmailVerificationToken{}).
		Where("email = ? AND used = ? AND expires_at > ?", email, false, now).
		Update("used", true).Error; err != nil {
		return nil, fmt.Errorf("invalidate existing verification tokens: %w", err)
	}

	token, err := generateHexToken(s.config.Auth.EmailVerificationTokenLength)
	if err != nil {
		return nil, err
	}

	row := &EmailVerificationToken{
		Email:     email,
		Token:     token,
		ExpiresAt: now.Add(s.config.Auth.EmailVerificationExpiry),
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, fmt.Errorf("create email verification token: %w", err)
	}
	return row, nil
}

func (s *Service) ValidateEmailVerificationToken(token string) (*EmailVerificationToken, error) {
	if !s.config.Auth.EmailVerificationEnabled {
		return nil, ErrEmailVerificationDisabled
	}

	var row EmailVerificationToken
	if err := s.db.Where("token = ?", token).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmailVerificationTokenInvalid
		}
		return nil, fmt.Errorf("validate email verification token: %w", err)
	}
	if row.Used {
		return nil, ErrEmailVerificationTokenUsed
	}
	if time.Now().After(row.ExpiresAt) {
		return nil, ErrEmailVerificationTokenExpired
	}
	return &row, nil
}

func (s *Service) useEmailVerificationToken(token string) (*EmailVerificationToken, error) {
	row, err := s.ValidateEmailVerificationToken(token)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	row.Used = true
	row.UsedAt = &now
	if err := s.db.Save(row).Error; err != nil {
		return nil, fmt.Errorf("mark email verification token used: %w", err)
	}
	return row, nil
}

func (s *Service) sendEmailVerificationEmail(email, verificationURL string, expiry time.Duration) error {
	if s.mailService == nil {
		return fmt.Errorf("mail service is not configured")
	}
	return s.mailService.SendTemplate("email_verification", []string{email}, "Please verify your email address", map[string]any{
		"Email":           email,
		"VerificationURL": verificationURL,
		"ExpiryDuration":  expiry.String(),
		"AppName":         s.config.App.Name,
	})
}

func (s *Service) RequestEmailVerification(email string) error {
	if !s.config.Auth.EmailVerificationEnabled {
		return ErrEmailVerificationDisabled
	}
	token, err := s.createEmailVerificationToken(email)
	if err != nil {
		return err
	}
	url := fmt.Sprintf("%s/auth/verify-email?token=%s", s.config.App.URL, token.Token)
	if err := s.sendEmailVerificationEmail(email, url, s.config.Auth.EmailVerificationExpiry); err != nil {
		s.logger.Error("send email verification failed", zap.String("email", email), zap.Error(err))
		return fmt.Errorf("failed to send email verification email: %w", err)
	}
	return nil
}

func (s *Service) VerifyEmail(token string) error {
	row, err := s.useEmailVerificationToken(token)
	if err != nil {
		return err
	}

	result := s.db.Table("users").Where("email = ?", row.Email).Update("email_verified_at", time.Now())
	if result.Error != nil {
		return fmt.Errorf("mark email verified: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *Service) IsEmailVerificationRequired() bool {
	return s.config.Auth.EmailVerificationEnabled
}

func (s *Service) IsEmailVerified(email string) bool {
	if !s.config.Auth.EmailVerificationEnabled {
		return true
	}
	var count int64
	s.db.Table("users").Where("email = ? AND email_verified_at IS NOT NULL", email).Count(&count)
	return count > 0
}
