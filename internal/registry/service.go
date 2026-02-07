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

func (s *Service) Logger() *logging.Service {
	return s.logger
}

// CreateCredential creates a new registry credential with encrypted password
func (s *Service) CreateCredential(serverID uint, stackPattern, registryURL, imagePattern, username, password string) (*models.ServerRegistryCredential, error) {
	s.logger.Info("creating registry credential",
		zap.Uint("server_id", serverID),
		zap.String("stack_pattern", stackPattern),
		zap.String("registry_url", registryURL),
		zap.String("image_pattern", imagePattern),
		zap.String("username", username),
	)

	if stackPattern == "" {
		return nil, errors.New("stack pattern is required")
	}
	if registryURL == "" {
		return nil, errors.New("registry URL is required")
	}
	if username == "" {
		return nil, errors.New("username is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}

	var existing models.ServerRegistryCredential
	err := s.db.Where("server_id = ? AND stack_pattern = ? AND registry_url = ?", serverID, stackPattern, registryURL).First(&existing).Error
	if err == nil {
		s.logger.Warn("registry credential already exists",
			zap.Uint("server_id", serverID),
			zap.String("stack_pattern", stackPattern),
			zap.String("registry_url", registryURL),
		)
		return nil, errors.New("registry credential already exists for this server/stack/registry combination")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.Error("failed to check existing credential",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_pattern", stackPattern),
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
			zap.String("stack_pattern", stackPattern),
			zap.String("registry_url", registryURL),
		)
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	credential := models.ServerRegistryCredential{
		ServerID:     serverID,
		StackPattern: stackPattern,
		RegistryURL:  registryURL,
		ImagePattern: imagePattern,
		Username:     username,
		Password:     encryptedPassword,
	}

	if err := s.db.Create(&credential).Error; err != nil {
		s.logger.Error("failed to create registry credential",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_pattern", stackPattern),
			zap.String("registry_url", registryURL),
		)
		return nil, err
	}

	s.logger.Info("registry credential created successfully",
		zap.Uint("credential_id", credential.ID),
		zap.Uint("server_id", serverID),
		zap.String("stack_pattern", stackPattern),
		zap.String("registry_url", registryURL),
	)

	return &credential, nil
}

// UpdateCredential updates an existing registry credential
func (s *Service) UpdateCredential(credID uint, stackPattern, registryURL, imagePattern, username, password string) (*models.ServerRegistryCredential, error) {
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

	if stackPattern != "" {
		credential.StackPattern = stackPattern
	}

	if registryURL != "" {
		credential.RegistryURL = registryURL
	}

	if imagePattern != "" {
		credential.ImagePattern = imagePattern
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

	var credential models.ServerRegistryCredential
	if err := s.db.First(&credential, credID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Warn("no credential found to delete",
				zap.Uint("credential_id", credID),
			)
			return gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to fetch registry credential for deletion",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return err
	}

	if err := s.db.Delete(&credential).Error; err != nil {
		s.logger.Error("failed to delete registry credential",
			zap.Error(err),
			zap.Uint("credential_id", credID),
		)
		return err
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

func (s *Service) GetCredentialForStack(serverID uint, stackName, registryURL string) (*RegistryCredential, error) {
	s.logger.Debug("getting credential for stack",
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("registry_url", registryURL),
	)

	var credentials []models.ServerRegistryCredential
	err := s.db.Where("server_id = ? AND registry_url = ?", serverID, registryURL).
		Order("stack_pattern").
		Find(&credentials).Error
	if err != nil {
		s.logger.Error("failed to query credentials",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("registry_url", registryURL),
		)
		return nil, err
	}

	var matchedCredential *models.ServerRegistryCredential
	for i := range credentials {
		if utils.MatchesPattern(stackName, credentials[i].StackPattern) {
			if matchedCredential == nil ||
				(credentials[i].StackPattern != "*" && matchedCredential.StackPattern == "*") ||
				(credentials[i].StackPattern == stackName) {
				matchedCredential = &credentials[i]
			}
		}
	}

	if matchedCredential == nil {
		s.logger.Debug("no matching credential found for stack",
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
			zap.String("registry_url", registryURL),
		)
		return nil, gorm.ErrRecordNotFound
	}

	decryptedPassword, err := s.crypto.Decrypt(matchedCredential.Password)
	if err != nil {
		s.logger.Error("failed to decrypt password",
			zap.Error(err),
			zap.Uint("credential_id", matchedCredential.ID),
		)
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}

	s.logger.Debug("credential found and decrypted",
		zap.Uint("credential_id", matchedCredential.ID),
		zap.String("stack_pattern", matchedCredential.StackPattern),
	)

	return &RegistryCredential{
		Registry: matchedCredential.RegistryURL,
		Username: matchedCredential.Username,
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

func (s *Service) GetCredentialsForStack(serverID uint, stackName string) ([]models.ServerRegistryCredential, error) {
	var credentials []models.ServerRegistryCredential
	err := s.db.Where("server_id = ?", serverID).Find(&credentials).Error
	if err != nil {
		return nil, err
	}

	var matched []models.ServerRegistryCredential
	for _, cred := range credentials {
		if utils.MatchesPattern(stackName, cred.StackPattern) {
			matched = append(matched, cred)
		}
	}

	return matched, nil
}
