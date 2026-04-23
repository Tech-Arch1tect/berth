package totp

import (
	"errors"
	"fmt"
	"time"

	"berth/internal/pkg/config"
	"berth/models"

	"github.com/pquerna/otp/totp"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type (
	TOTPSecret = models.TOTPSecret
	UsedCode   = models.UsedCode
)

var (
	ErrTOTPDisabled    = errors.New("TOTP is disabled")
	ErrInvalidCode     = errors.New("invalid TOTP code")
	ErrSecretExists    = errors.New("TOTP secret already exists for user")
	ErrSecretNotFound  = errors.New("TOTP secret not found for user")
	ErrCodeAlreadyUsed = errors.New("TOTP code has already been used")
)

const codeReplayWindow = 90 * time.Second

type Service struct {
	cfg    *config.Config
	db     *gorm.DB
	logger *zap.Logger
}

func NewService(cfg *config.Config, db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{cfg: cfg, db: db, logger: logger}
}

func (s *Service) enabled() bool { return s.cfg.TOTP.Enabled }

func (s *Service) GenerateSecret(userID uint, accountName string) (*TOTPSecret, error) {
	if !s.enabled() {
		return nil, ErrTOTPDisabled
	}

	var existing TOTPSecret
	if err := s.db.Where("user_id = ?", userID).First(&existing).Error; err == nil {
		return nil, ErrSecretExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("check existing TOTP secret: %w", err)
	}

	secretString, err := s.generateTOTPKey(accountName)
	if err != nil {
		return nil, err
	}

	var deleted TOTPSecret
	if err := s.db.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).First(&deleted).Error; err == nil {
		deleted.Secret = secretString
		deleted.Enabled = false
		deleted.DeletedAt = gorm.DeletedAt{}
		if err := s.db.Unscoped().Save(&deleted).Error; err != nil {
			return nil, fmt.Errorf("restore TOTP secret: %w", err)
		}
		return &deleted, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("check deleted TOTP secret: %w", err)
	}

	row := &TOTPSecret{UserID: userID, Secret: secretString, Enabled: false}
	if err := s.db.Create(row).Error; err != nil {
		return nil, fmt.Errorf("store TOTP secret: %w", err)
	}
	return row, nil
}

func (s *Service) generateTOTPKey(accountName string) (string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      s.cfg.TOTP.Issuer,
		AccountName: accountName,
	})
	if err != nil {
		return "", fmt.Errorf("generate TOTP key: %w", err)
	}
	return key.Secret(), nil
}

func (s *Service) GetSecret(userID uint) (*TOTPSecret, error) {
	if !s.enabled() {
		return nil, ErrTOTPDisabled
	}

	var row TOTPSecret
	if err := s.db.Where("user_id = ?", userID).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSecretNotFound
		}
		return nil, fmt.Errorf("retrieve TOTP secret: %w", err)
	}
	return &row, nil
}

func (s *Service) EnableTOTP(userID uint, code string) error {
	if !s.enabled() {
		return ErrTOTPDisabled
	}
	secret, err := s.GetSecret(userID)
	if err != nil {
		return err
	}
	if !totp.Validate(code, secret.Secret) {
		return ErrInvalidCode
	}
	secret.Enabled = true
	if err := s.db.Save(secret).Error; err != nil {
		return fmt.Errorf("enable TOTP: %w", err)
	}
	s.logger.Info("TOTP enabled", zap.Uint("user_id", userID))
	return nil
}

func (s *Service) DisableTOTP(userID uint) error {
	if !s.enabled() {
		return ErrTOTPDisabled
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("user_id = ?", userID).Delete(&TOTPSecret{})
		if result.Error != nil {
			return fmt.Errorf("delete TOTP secret: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrSecretNotFound
		}
		if err := tx.Where("user_id = ?", userID).Delete(&UsedCode{}).Error; err != nil {
			return fmt.Errorf("cleanup used codes: %w", err)
		}
		s.logger.Info("TOTP disabled", zap.Uint("user_id", userID))
		return nil
	})
}

func (s *Service) GenerateProvisioningURI(secret *TOTPSecret, accountName string) (string, error) {
	if !s.enabled() {
		return "", ErrTOTPDisabled
	}
	issuer := s.cfg.TOTP.Issuer
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, accountName, secret.Secret, issuer), nil
}

func (s *Service) IsUserTOTPEnabled(userID uint) bool {
	if !s.enabled() {
		return false
	}
	secret, err := s.GetSecret(userID)
	if err != nil {
		return false
	}
	return secret.Enabled
}

func (s *Service) VerifyUserCode(userID uint, code string) error {
	if !s.enabled() {
		return ErrTOTPDisabled
	}
	secret, err := s.GetSecret(userID)
	if err != nil {
		return err
	}
	if !secret.Enabled {
		return ErrSecretNotFound
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		cutoff := time.Now().Add(-codeReplayWindow).Unix()
		var existing UsedCode
		if err := tx.Where("user_id = ? AND code = ? AND used_at > ?", userID, code, cutoff).First(&existing).Error; err == nil {
			s.logger.Warn("TOTP code replay attempt", zap.Uint("user_id", userID))
			return ErrCodeAlreadyUsed
		}
		if !totp.Validate(code, secret.Secret) {
			return ErrInvalidCode
		}
		used := &UsedCode{UserID: userID, Code: code, UsedAt: time.Now().Unix()}
		if err := tx.Create(used).Error; err != nil {
			return fmt.Errorf("store used code: %w", err)
		}
		return nil
	})
}

var Module = fx.Module("totp",
	fx.Provide(NewService),
)
