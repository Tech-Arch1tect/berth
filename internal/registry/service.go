package registry

import (
	"berth/models"
	"berth/utils"
	"errors"
	"fmt"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	crypto *utils.Crypto
	logger *logging.Service
}

type RegistryCredential struct {
	Registry string
	Username string
	Password string
}

func NewService(db *gorm.DB, crypto *utils.Crypto, logger *logging.Service) *Service {
	return &Service{
		db:     db,
		crypto: crypto,
		logger: logger,
	}
}

// CreateCredential creates a new registry credential with encrypted password
func (s *Service) CreateCredential(serverID uint, registryURL, username, password string) (*models.ServerRegistryCredential, error) {
	s.logger.Info("creating registry credential",
		zap.Uint("server_id", serverID),
		zap.String("registry_url", registryURL),
		zap.String("username", username),
	)

	if registryURL == "" {
		return nil, errors.New("registry URL is required")
	}
	if username == "" {
		return nil, errors.New("username is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}

	// Check if credential already exists
	var existing models.ServerRegistryCredential
	err := s.db.Where("server_id = ? AND registry_url = ?", serverID, registryURL).First(&existing).Error
	if err == nil {
		s.logger.Warn("registry credential already exists",
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, errors.New("registry credential already exists for this server")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.Error("failed to check existing credential",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, err
	}

	// Encrypt password
	encryptedPassword, err := s.crypto.Encrypt(password)
	if err != nil {
		s.logger.Error("failed to encrypt password",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	credential := models.ServerRegistryCredential{
		ServerID:    serverID,
		RegistryURL: registryURL,
		Username:    username,
		Password:    encryptedPassword,
		IsDefault:   false,
	}

	if err := s.db.Create(&credential).Error; err != nil {
		s.logger.Error("failed to create registry credential",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, err
	}

	s.logger.Info("registry credential created successfully",
		zap.Uint("credential_id", credential.ID),
		zap.Uint("server_id", serverID),
		zap.String("registry_url", registryURL),
	)

	return &credential, nil
}

// UpdateCredential updates an existing registry credential
func (s *Service) UpdateCredential(credID uint, username, password string) (*models.ServerRegistryCredential, error) {
	s.logger.Info("updating registry credential",
		zap.Uint("credential_id", credID),
	)

	var credential models.ServerRegistryCredential
	if err := s.db.First(&credential, credID).Error; err != nil {
		s.logger.Error("failed to find credential for update",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return nil, err
	}

	if username != "" {
		credential.Username = username
	}

	if password != "" {
		encryptedPassword, err := s.crypto.Encrypt(password)
		if err != nil {
			s.logger.Error("failed to encrypt password during update",
				zap.Error(err),
				zap.Uint("credential_id", credID),
			)
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		credential.Password = encryptedPassword
	}

	if err := s.db.Save(&credential).Error; err != nil {
		s.logger.Error("failed to update registry credential",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return nil, err
	}

	s.logger.Info("registry credential updated successfully",
		zap.Uint("credential_id", credID),
	)

	return &credential, nil
}

// DeleteCredential deletes a registry credential
func (s *Service) DeleteCredential(credID uint) error {
	s.logger.Info("deleting registry credential",
		zap.Uint("credential_id", credID),
	)

	result := s.db.Delete(&models.ServerRegistryCredential{}, credID)
	if result.Error != nil {
		s.logger.Error("failed to delete registry credential",
			zap.Error(result.Error),
			zap.Uint("credential_id", credID),
		)
		return result.Error
	}

	if result.RowsAffected == 0 {
		s.logger.Warn("no credential found to delete",
			zap.Uint("credential_id", credID),
		)
		return gorm.ErrRecordNotFound
	}

	s.logger.Info("registry credential deleted successfully",
		zap.Uint("credential_id", credID),
	)

	return nil
}

// GetCredentials retrieves all credentials for a server (with masked passwords)
func (s *Service) GetCredentials(serverID uint) ([]models.ServerRegistryCredential, error) {
	var credentials []models.ServerRegistryCredential
	err := s.db.Where("server_id = ?", serverID).Find(&credentials).Error
	if err != nil {
		s.logger.Error("failed to get credentials for server",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return nil, err
	}

	return credentials, nil
}

// GetCredential retrieves a specific credential by ID
func (s *Service) GetCredential(credID uint) (*models.ServerRegistryCredential, error) {
	var credential models.ServerRegistryCredential
	err := s.db.First(&credential, credID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to get credential",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return nil, err
	}

	return &credential, nil
}

// GetDecryptedCredential retrieves and decrypts a credential for a specific registry
func (s *Service) GetDecryptedCredential(serverID uint, registryURL string) (*RegistryCredential, error) {
	s.logger.Debug("getting decrypted credential",
		zap.Uint("server_id", serverID),
		zap.String("registry_url", registryURL),
	)

	var credential models.ServerRegistryCredential
	err := s.db.Where("server_id = ? AND registry_url = ?", serverID, registryURL).First(&credential).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("no credential found for registry",
				zap.Uint("server_id", serverID),
				zap.String("registry_url", registryURL),
			)
			return nil, gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to get credential",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, err
	}

	decryptedPassword, err := s.crypto.Decrypt(credential.Password)
	if err != nil {
		s.logger.Error("failed to decrypt password",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}

	return &RegistryCredential{
		Registry: credential.RegistryURL,
		Username: credential.Username,
		Password: decryptedPassword,
	}, nil
}

// GetDecryptedCredentialByID retrieves and decrypts a credential by ID
func (s *Service) GetDecryptedCredentialByID(credID uint) (*RegistryCredential, error) {
	var credential models.ServerRegistryCredential
	err := s.db.First(&credential, credID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to get credential by ID",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return nil, err
	}

	decryptedPassword, err := s.crypto.Decrypt(credential.Password)
	if err != nil {
		s.logger.Error("failed to decrypt password",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}

	return &RegistryCredential{
		Registry: credential.RegistryURL,
		Username: credential.Username,
		Password: decryptedPassword,
	}, nil
}

// SetDefaultCredential marks a credential as the default for its server
func (s *Service) SetDefaultCredential(credID uint) error {
	s.logger.Info("setting default registry credential",
		zap.Uint("credential_id", credID),
	)

	var credential models.ServerRegistryCredential
	if err := s.db.First(&credential, credID).Error; err != nil {
		s.logger.Error("failed to find credential",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return err
	}

	// Unset all other defaults for this server
	if err := s.db.Model(&models.ServerRegistryCredential{}).
		Where("server_id = ? AND id != ?", credential.ServerID, credID).
		Update("is_default", false).Error; err != nil {
		s.logger.Error("failed to unset other defaults",
			zap.Error(err),
			zap.Uint("server_id", credential.ServerID),
		)
		return err
	}

	// Set this one as default
	credential.IsDefault = true
	if err := s.db.Save(&credential).Error; err != nil {
		s.logger.Error("failed to set credential as default",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return err
	}

	s.logger.Info("credential set as default successfully",
		zap.Uint("credential_id", credID),
		zap.Uint("server_id", credential.ServerID),
	)

	return nil
}
