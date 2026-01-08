package apikey

import (
	"berth/models"
	"berth/utils"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	KeyPrefix = "brth_"
	KeyLength = 32
)

type RBACService interface {
	UserHasServerAccess(ctx context.Context, userID uint, serverID uint) (bool, error)
	UserHasAnyStackPermission(ctx context.Context, userID uint, serverID uint, permissionName string) (bool, error)
	GetUserAccessibleServerIDs(ctx context.Context, userID uint) ([]uint, error)
}

type Service struct {
	db          *gorm.DB
	logger      *logging.Service
	rbacService RBACService
}

func NewService(db *gorm.DB, logger *logging.Service, rbacService RBACService) *Service {
	return &Service{
		db:          db,
		logger:      logger,
		rbacService: rbacService,
	}
}

func (s *Service) GenerateAPIKey(userID uint, name string, expiresAt *time.Time) (string, *models.APIKey, error) {
	s.logger.Info("generating new API key",
		zap.Uint("user_id", userID),
		zap.String("name", name),
	)

	if name == "" {
		return "", nil, errors.New("API key name is required")
	}

	keyBytes := make([]byte, KeyLength)
	if _, err := rand.Read(keyBytes); err != nil {
		s.logger.Error("failed to generate random key",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return "", nil, err
	}

	keyValue := base64.RawURLEncoding.EncodeToString(keyBytes)
	fullKey := KeyPrefix + keyValue

	hash := sha256.Sum256([]byte(fullKey))
	keyHash := base64.StdEncoding.EncodeToString(hash[:])

	displayPrefix := KeyPrefix
	if len(keyValue) >= 8 {
		displayPrefix = KeyPrefix + keyValue[:8]
	}

	apiKey := models.APIKey{
		UserID:    userID,
		Name:      name,
		KeyPrefix: displayPrefix,
		KeyHash:   keyHash,
		ExpiresAt: expiresAt,
		IsActive:  true,
	}

	if err := s.db.Create(&apiKey).Error; err != nil {
		s.logger.Error("failed to create API key in database",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("name", name),
		)
		return "", nil, err
	}

	s.logger.Info("API key created successfully",
		zap.Uint("api_key_id", apiKey.ID),
		zap.Uint("user_id", userID),
		zap.String("name", name),
		zap.String("key_prefix", displayPrefix),
	)

	return fullKey, &apiKey, nil
}

func (s *Service) ValidateAPIKey(key string) (*models.User, *models.APIKey, error) {
	if key == "" {
		return nil, nil, errors.New("API key is required")
	}

	hash := sha256.Sum256([]byte(key))
	keyHash := base64.StdEncoding.EncodeToString(hash[:])

	var apiKey models.APIKey
	err := s.db.Preload("User.Roles").
		Preload("Scopes.Permission").
		Preload("Scopes.Server").
		Where("key_hash = ?", keyHash).
		First(&apiKey).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("API key not found",
				zap.String("key_hash", keyHash[:16]+"..."),
			)
			return nil, nil, errors.New("invalid API key")
		}
		s.logger.Error("failed to query API key",
			zap.Error(err),
		)
		return nil, nil, err
	}

	if !apiKey.IsValid() {
		s.logger.Debug("API key is not valid",
			zap.Uint("api_key_id", apiKey.ID),
			zap.Bool("is_active", apiKey.IsActive),
			zap.Bool("is_expired", apiKey.IsExpired()),
		)
		return nil, nil, errors.New("API key is inactive or expired")
	}

	now := time.Now()
	apiKey.LastUsedAt = &now
	if err := s.db.Model(&apiKey).Update("last_used_at", now).Error; err != nil {
		s.logger.Warn("failed to update API key last used timestamp",
			zap.Error(err),
			zap.Uint("api_key_id", apiKey.ID),
		)

	}

	s.logger.Debug("API key validated successfully",
		zap.Uint("api_key_id", apiKey.ID),
		zap.Uint("user_id", apiKey.UserID),
	)

	return &apiKey.User, &apiKey, nil
}

func (s *Service) ListAPIKeys(userID uint) ([]models.APIKey, error) {
	var apiKeys []models.APIKey
	err := s.db.Preload("Scopes").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&apiKeys).Error

	if err != nil {
		s.logger.Error("failed to list API keys",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, err
	}

	return apiKeys, nil
}

func (s *Service) GetAPIKey(apiKeyID uint, userID uint) (*models.APIKey, error) {
	var apiKey models.APIKey
	err := s.db.Preload("Scopes.Permission").
		Preload("Scopes.Server").
		Where("id = ? AND user_id = ?", apiKeyID, userID).
		First(&apiKey).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		s.logger.Error("failed to get API key",
			zap.Error(err),
			zap.Uint("api_key_id", apiKeyID),
			zap.Uint("user_id", userID),
		)
		return nil, err
	}

	return &apiKey, nil
}

func (s *Service) RevokeAPIKey(apiKeyID uint, userID uint) error {
	s.logger.Info("revoking API key",
		zap.Uint("api_key_id", apiKeyID),
		zap.Uint("user_id", userID),
	)

	result := s.db.Delete(&models.APIKey{}, "id = ? AND user_id = ?", apiKeyID, userID)

	if result.Error != nil {
		s.logger.Error("failed to revoke API key",
			zap.Error(result.Error),
			zap.Uint("api_key_id", apiKeyID),
			zap.Uint("user_id", userID),
		)
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("API key not found")
	}

	s.logger.Info("API key revoked successfully",
		zap.Uint("api_key_id", apiKeyID),
		zap.Uint("user_id", userID),
	)

	return nil
}

func (s *Service) AddScope(ctx context.Context, apiKeyID uint, userID uint, serverID *uint, stackPattern string, permissionName string) error {
	s.logger.Info("adding scope to API key",
		zap.Uint("api_key_id", apiKeyID),
		zap.Uint("user_id", userID),
		zap.Any("server_id", serverID),
		zap.String("stack_pattern", stackPattern),
		zap.String("permission_name", permissionName),
	)

	var apiKey models.APIKey
	err := s.db.Where("id = ? AND user_id = ?", apiKeyID, userID).First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("API key not found")
		}
		return err
	}

	var permission models.Permission
	err = s.db.Where("name = ?", permissionName).First(&permission).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("permission '%s' not found", permissionName)
		}
		return err
	}

	if permission.IsAPIKeyOnly {
		if strings.HasPrefix(permission.Name, "admin.") {
			var user models.User
			err = s.db.Preload("Roles").First(&user, userID).Error
			if err != nil {
				s.logger.Error("failed to load user roles",
					zap.Error(err),
					zap.Uint("user_id", userID),
				)
				return errors.New("failed to verify user permissions")
			}

			isAdmin := false
			for _, role := range user.Roles {
				if role.IsAdmin {
					isAdmin = true
					break
				}
			}

			if !isAdmin {
				s.logger.Warn("non-admin user attempted to grant admin API key scope",
					zap.Uint("user_id", userID),
					zap.String("permission", permissionName),
				)
				return errors.New("admin role required to grant admin API key scopes")
			}
		}
	} else if serverID != nil {

		var server models.Server
		err = s.db.First(&server, *serverID).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("server not found")
			}
			return err
		}

		hasAccess, err := s.rbacService.UserHasServerAccess(ctx, userID, *serverID)
		if err != nil {
			s.logger.Error("failed to check user server access",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.Uint("server_id", *serverID),
			)
			return errors.New("failed to verify server access")
		}
		if !hasAccess {
			s.logger.Warn("user attempted to add scope for unauthorized server",
				zap.Uint("user_id", userID),
				zap.Uint("server_id", *serverID),
			)
			return errors.New("you do not have access to this server")
		}

		hasPermission, err := s.rbacService.UserHasAnyStackPermission(ctx, userID, *serverID, permissionName)
		if err != nil {
			s.logger.Error("failed to check user permission",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.Uint("server_id", *serverID),
				zap.String("permission", permissionName),
			)
			return errors.New("failed to verify permission")
		}
		if !hasPermission {
			s.logger.Warn("user attempted to grant permission they don't have",
				zap.Uint("user_id", userID),
				zap.Uint("server_id", *serverID),
				zap.String("permission", permissionName),
			)
			return errors.New("you do not have this permission to grant")
		}
	} else {

		accessibleServers, err := s.rbacService.GetUserAccessibleServerIDs(ctx, userID)
		if err != nil {
			s.logger.Error("failed to get user accessible servers",
				zap.Error(err),
				zap.Uint("user_id", userID),
			)
			return errors.New("failed to verify server access")
		}

		if len(accessibleServers) == 0 {
			s.logger.Warn("user attempted to create 'all servers' scope with no server access",
				zap.Uint("user_id", userID),
			)
			return errors.New("you do not have access to any servers")
		}

		hasPermissionAnywhere := false
		for _, srvID := range accessibleServers {
			hasPermission, err := s.rbacService.UserHasAnyStackPermission(ctx, userID, srvID, permissionName)
			if err != nil {
				continue
			}
			if hasPermission {
				hasPermissionAnywhere = true
				break
			}
		}

		if !hasPermissionAnywhere {
			s.logger.Warn("user attempted to grant permission they don't have on any server",
				zap.Uint("user_id", userID),
				zap.String("permission", permissionName),
			)
			return errors.New("you do not have this permission on any accessible server")
		}
	}

	var existing models.APIKeyScope
	query := s.db.Where("api_key_id = ? AND stack_pattern = ? AND permission_id = ?",
		apiKeyID, stackPattern, permission.ID)

	if serverID != nil {
		query = query.Where("server_id = ?", *serverID)
	} else {
		query = query.Where("server_id IS NULL")
	}

	err = query.First(&existing).Error
	if err == nil {
		return errors.New("this scope already exists for the API key")
	}

	scope := models.APIKeyScope{
		APIKeyID:     apiKeyID,
		ServerID:     serverID,
		StackPattern: stackPattern,
		PermissionID: permission.ID,
	}

	if err := s.db.Create(&scope).Error; err != nil {
		s.logger.Error("failed to create API key scope",
			zap.Error(err),
			zap.Uint("api_key_id", apiKeyID),
		)
		return err
	}

	s.logger.Info("API key scope added successfully",
		zap.Uint("scope_id", scope.ID),
		zap.Uint("api_key_id", apiKeyID),
	)

	return nil
}

func (s *Service) RemoveScope(scopeID uint, userID uint) error {
	s.logger.Info("removing scope from API key",
		zap.Uint("scope_id", scopeID),
		zap.Uint("user_id", userID),
	)

	result := s.db.Where("id = ? AND api_key_id IN (?)",
		scopeID,
		s.db.Table("api_keys").Select("id").Where("user_id = ?", userID),
	).Delete(&models.APIKeyScope{})

	if result.Error != nil {
		s.logger.Error("failed to remove API key scope",
			zap.Error(result.Error),
			zap.Uint("scope_id", scopeID),
		)
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("scope not found")
	}

	s.logger.Info("API key scope removed successfully",
		zap.Uint("scope_id", scopeID),
	)

	return nil
}

func (s *Service) CheckAPIKeyPermission(apiKey *models.APIKey, userHasPermission bool, serverID uint, stackName string, permissionName string) (bool, error) {
	s.logger.Debug("checking API key permission",
		zap.Uint("api_key_id", apiKey.ID),
		zap.Uint("user_id", apiKey.UserID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("permission_name", permissionName),
		zap.Bool("user_has_permission", userHasPermission),
	)

	if !userHasPermission {
		s.logger.Debug("user does not have permission, API key denied",
			zap.Uint("api_key_id", apiKey.ID),
			zap.String("permission_name", permissionName),
		)
		return false, nil
	}

	for _, scope := range apiKey.Scopes {

		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}

		if !utils.MatchesPattern(stackName, scope.StackPattern) {
			continue
		}

		if scope.Permission.Name == permissionName {
			s.logger.Debug("API key permission granted",
				zap.Uint("api_key_id", apiKey.ID),
				zap.Uint("scope_id", scope.ID),
				zap.String("permission_name", permissionName),
			)
			return true, nil
		}
	}

	s.logger.Debug("API key permission denied - no matching scope",
		zap.Uint("api_key_id", apiKey.ID),
		zap.String("permission_name", permissionName),
	)

	return false, nil
}

func (s *Service) ListScopes(apiKeyID uint, userID uint) ([]models.APIKeyScope, error) {

	var apiKey models.APIKey
	err := s.db.Where("id = ? AND user_id = ?", apiKeyID, userID).First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, err
	}

	var scopes []models.APIKeyScope
	err = s.db.Preload("Permission").
		Preload("Server").
		Where("api_key_id = ?", apiKeyID).
		Order("created_at DESC").
		Find(&scopes).Error

	if err != nil {
		s.logger.Error("failed to list API key scopes",
			zap.Error(err),
			zap.Uint("api_key_id", apiKeyID),
		)
		return nil, err
	}

	return scopes, nil
}
