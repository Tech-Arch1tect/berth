package auth

import (
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (s *Service) createPasswordResetToken(email string) (*PasswordResetToken, error) {
	if !s.config.Auth.PasswordResetEnabled {
		return nil, ErrPasswordResetDisabled
	}

	now := time.Now()
	if err := s.db.Model(&PasswordResetToken{}).
		Where("email = ? AND used = ? AND expires_at > ?", email, false, now).
		Update("used", true).Error; err != nil {
		return nil, fmt.Errorf("invalidate existing reset tokens: %w", err)
	}

	token, err := generateHexToken(s.config.Auth.PasswordResetTokenLength)
	if err != nil {
		return nil, err
	}

	row := &PasswordResetToken{
		Email:     email,
		Token:     token,
		ExpiresAt: now.Add(s.config.Auth.PasswordResetExpiry),
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, fmt.Errorf("create password reset token: %w", err)
	}
	return row, nil
}

func (s *Service) ValidatePasswordResetToken(token string) (*PasswordResetToken, error) {
	if !s.config.Auth.PasswordResetEnabled {
		return nil, ErrPasswordResetDisabled
	}

	var row PasswordResetToken
	if err := s.db.Where("token = ?", token).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPasswordResetTokenInvalid
		}
		return nil, fmt.Errorf("validate password reset token: %w", err)
	}

	if row.Used {
		return nil, ErrPasswordResetTokenUsed
	}
	if time.Now().After(row.ExpiresAt) {
		return nil, ErrPasswordResetTokenExpired
	}
	return &row, nil
}

func (s *Service) usePasswordResetToken(token string) (*PasswordResetToken, error) {
	row, err := s.ValidatePasswordResetToken(token)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	row.Used = true
	row.UsedAt = &now
	if err := s.db.Save(row).Error; err != nil {
		return nil, fmt.Errorf("mark password reset token used: %w", err)
	}
	return row, nil
}

func (s *Service) CleanupExpiredTokens() error {
	if !s.config.Auth.PasswordResetEnabled {
		return ErrPasswordResetDisabled
	}
	result := s.db.Where("expires_at < ?", time.Now()).Delete(&PasswordResetToken{})
	if result.Error != nil {
		return fmt.Errorf("cleanup expired reset tokens: %w", result.Error)
	}
	if result.RowsAffected > 0 {
		s.logger.Info("expired password reset tokens cleaned", zap.Int64("count", result.RowsAffected))
	}
	return nil
}

func (s *Service) ResetPassword(token, newPassword string) error {
	hashedPassword, err := s.HashPassword(newPassword)
	if err != nil {
		return err
	}

	resetToken, err := s.usePasswordResetToken(token)
	if err != nil {
		return err
	}

	result := s.db.Table("users").Where("email = ?", resetToken.Email).Update("password", hashedPassword)
	if result.Error != nil {
		return fmt.Errorf("update password: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *Service) sendPasswordResetEmail(email, resetURL string, expiry time.Duration) error {
	if s.mailService == nil {
		return fmt.Errorf("mail service is not configured")
	}
	return s.mailService.SendTemplate("password_reset", []string{email}, "Password Reset Request", map[string]any{
		"Email":          email,
		"ResetURL":       resetURL,
		"ExpiryDuration": expiry.String(),
		"AppName":        s.config.App.Name,
	})
}

func (s *Service) sendPasswordResetSuccessEmail(email string) error {
	if s.mailService == nil {
		return fmt.Errorf("mail service is not configured")
	}
	return s.mailService.SendTemplate("password_reset_success", []string{email}, "Password Reset Successful", map[string]any{
		"Email":   email,
		"AppName": s.config.App.Name,
	})
}

func (s *Service) RequestPasswordReset(email string) error {
	if !s.config.Auth.PasswordResetEnabled {
		return ErrPasswordResetDisabled
	}

	resetToken, err := s.createPasswordResetToken(email)
	if err != nil {
		return err
	}

	resetURL := fmt.Sprintf("%s/auth/password-reset/confirm?token=%s", s.config.App.URL, resetToken.Token)
	if err := s.sendPasswordResetEmail(email, resetURL, s.config.Auth.PasswordResetExpiry); err != nil {
		s.logger.Error("send password reset email failed", zap.String("email", email), zap.Error(err))
		return fmt.Errorf("failed to send password reset email: %w", err)
	}
	return nil
}

func (s *Service) CompletePasswordReset(token, newPassword string) error {
	resetToken, err := s.ValidatePasswordResetToken(token)
	if err != nil {
		return err
	}

	if err := s.ResetPassword(token, newPassword); err != nil {
		return err
	}

	var userID uint
	if err := s.db.Table("users").Select("id").Where("email = ?", resetToken.Email).Scan(&userID).Error; err == nil && userID != 0 {
		if s.sessionInvalidator != nil {
			if revokeErr := s.sessionInvalidator.RevokeAllUserSessions(userID); revokeErr != nil {
				s.logger.Error("revoke sessions after password reset failed",
					zap.String("email", resetToken.Email), zap.Uint("user_id", userID), zap.Error(revokeErr))
			}
		}
		if s.config.Auth.RememberMeEnabled {
			if err := s.InvalidateRememberMeTokens(userID); err != nil {
				s.logger.Error("invalidate remember-me tokens after password reset failed",
					zap.String("email", resetToken.Email), zap.Uint("user_id", userID), zap.Error(err))
			}
		}
	}

	if err := s.sendPasswordResetSuccessEmail(resetToken.Email); err != nil {
		return fmt.Errorf("password was reset but failed to send confirmation email: %w", err)
	}
	return nil
}
