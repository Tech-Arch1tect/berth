package webhook

import (
	"berth/internal/rbac"
	"berth/models"
	"berth/utils"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	rbac   *rbac.Service
	logger *logging.Service
}

func NewService(db *gorm.DB, rbac *rbac.Service, logger *logging.Service) *Service {
	return &Service{
		db:     db,
		rbac:   rbac,
		logger: logger,
	}
}

func (s *Service) CreateWebhook(userID uint, req CreateWebhookRequest) (*models.WebhookWithAPIKey, error) {
	s.logger.Info("creating webhook",
		zap.Uint("user_id", userID),
		zap.String("name", req.Name),
	)

	apiKey, err := s.generateAPIKey()
	if err != nil {
		s.logger.Error("failed to generate API key",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	hashedKey, err := s.hashAPIKey(apiKey)
	if err != nil {
		s.logger.Error("failed to hash API key",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to hash API key: %w", err)
	}

	webhook := &models.Webhook{
		UserID:       userID,
		Name:         req.Name,
		Description:  req.Description,
		StackPattern: req.StackPattern,
		APIKeyHash:   hashedKey,
		IsActive:     true,
	}

	if req.ExpiresAt != nil {
		webhook.ExpiresAt = req.ExpiresAt
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {

		if err := tx.Create(webhook).Error; err != nil {
			return err
		}

		if len(req.ServerScopes) > 0 {
			for _, serverID := range req.ServerScopes {
				scope := &models.WebhookServerScope{
					WebhookID: webhook.ID,
					ServerID:  serverID,
				}
				if err := tx.Create(scope).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		s.logger.Error("failed to create webhook in database",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("name", req.Name),
		)
		return nil, fmt.Errorf("failed to create webhook: %w", err)
	}

	s.logger.Info("webhook created successfully",
		zap.Uint("webhook_id", webhook.ID),
		zap.Uint("user_id", userID),
		zap.String("name", req.Name),
	)

	webhook.ServerScopes = req.ServerScopes

	response := webhook.ToResponseWithAPIKey(apiKey)
	return &response, nil
}

func (s *Service) GetUserWebhooks(userID uint) ([]models.WebhookResponse, error) {
	s.logger.Debug("getting user webhooks",
		zap.Uint("user_id", userID),
	)

	var webhooks []models.Webhook
	err := s.db.Where("user_id = ?", userID).Find(&webhooks).Error
	if err != nil {
		s.logger.Error("failed to get user webhooks",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get webhooks: %w", err)
	}

	responses := make([]models.WebhookResponse, 0, len(webhooks))
	for _, webhook := range webhooks {

		var scopes []models.WebhookServerScope
		s.db.Where("webhook_id = ?", webhook.ID).Find(&scopes)

		response := webhook.ToResponse()
		response.ServerScopes = make([]uint, 0, len(scopes))
		for _, scope := range scopes {
			response.ServerScopes = append(response.ServerScopes, scope.ServerID)
		}

		responses = append(responses, response)
	}

	s.logger.Debug("user webhooks retrieved",
		zap.Uint("user_id", userID),
		zap.Int("webhook_count", len(responses)),
	)

	return responses, nil
}

func (s *Service) GetWebhook(webhookID uint, userID uint) (*models.WebhookResponse, error) {
	s.logger.Debug("getting webhook",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	var webhook models.Webhook
	err := s.db.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("webhook not found",
				zap.Uint("webhook_id", webhookID),
				zap.Uint("user_id", userID),
			)
			return nil, fmt.Errorf("webhook not found")
		}
		s.logger.Error("failed to get webhook",
			zap.Error(err),
			zap.Uint("webhook_id", webhookID),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to get webhook: %w", err)
	}

	var scopes []models.WebhookServerScope
	s.db.Where("webhook_id = ?", webhook.ID).Find(&scopes)

	response := webhook.ToResponse()
	response.ServerScopes = make([]uint, 0, len(scopes))
	for _, scope := range scopes {
		response.ServerScopes = append(response.ServerScopes, scope.ServerID)
	}

	return &response, nil
}

func (s *Service) UpdateWebhook(webhookID uint, userID uint, req UpdateWebhookRequest) (*models.WebhookResponse, error) {
	s.logger.Info("updating webhook",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	var webhook models.Webhook
	err := s.db.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("webhook not found")
		}
		return nil, fmt.Errorf("failed to get webhook: %w", err)
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {

		if req.Name != nil {
			webhook.Name = *req.Name
		}
		if req.Description != nil {
			webhook.Description = *req.Description
		}
		if req.StackPattern != nil {
			webhook.StackPattern = *req.StackPattern
		}
		if req.IsActive != nil {
			webhook.IsActive = *req.IsActive
		}
		if req.ExpiresAt != nil {
			webhook.ExpiresAt = req.ExpiresAt
		}

		if err := tx.Save(&webhook).Error; err != nil {
			return err
		}

		if req.ServerScopes != nil {

			if err := tx.Where("webhook_id = ?", webhookID).Delete(&models.WebhookServerScope{}).Error; err != nil {
				return err
			}

			for _, serverID := range *req.ServerScopes {
				scope := &models.WebhookServerScope{
					WebhookID: webhookID,
					ServerID:  serverID,
				}
				if err := tx.Create(scope).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		s.logger.Error("failed to update webhook",
			zap.Error(err),
			zap.Uint("webhook_id", webhookID),
			zap.Uint("user_id", userID),
		)
		return nil, fmt.Errorf("failed to update webhook: %w", err)
	}

	s.logger.Info("webhook updated successfully",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	return s.GetWebhook(webhookID, userID)
}

func (s *Service) DeleteWebhook(webhookID uint, userID uint) error {
	s.logger.Info("deleting webhook",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	err := s.db.Transaction(func(tx *gorm.DB) error {

		var webhook models.Webhook
		if err := tx.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("webhook not found")
			}
			return err
		}

		if err := tx.Where("webhook_id = ?", webhookID).Delete(&models.WebhookServerScope{}).Error; err != nil {
			return err
		}

		if err := tx.Delete(&webhook).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		s.logger.Error("failed to delete webhook",
			zap.Error(err),
			zap.Uint("webhook_id", webhookID),
			zap.Uint("user_id", userID),
		)
		return fmt.Errorf("failed to delete webhook: %w", err)
	}

	s.logger.Info("webhook deleted successfully",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	return nil
}

func (s *Service) RegenerateAPIKey(webhookID uint, userID uint) (string, error) {
	s.logger.Info("regenerating API key for webhook",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	var webhook models.Webhook
	err := s.db.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("webhook not found")
		}
		return "", fmt.Errorf("failed to get webhook: %w", err)
	}

	apiKey, err := s.generateAPIKey()
	if err != nil {
		return "", fmt.Errorf("failed to generate API key: %w", err)
	}

	hashedKey, err := s.hashAPIKey(apiKey)
	if err != nil {
		return "", fmt.Errorf("failed to hash API key: %w", err)
	}

	webhook.APIKeyHash = hashedKey
	if err := s.db.Save(&webhook).Error; err != nil {
		s.logger.Error("failed to update webhook with new API key",
			zap.Error(err),
			zap.Uint("webhook_id", webhookID),
			zap.Uint("user_id", userID),
		)
		return "", fmt.Errorf("failed to update webhook: %w", err)
	}

	s.logger.Info("API key regenerated successfully",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", userID),
	)

	return apiKey, nil
}

func (s *Service) ValidateAPIKey(webhookID uint, apiKey string) (*models.Webhook, error) {
	s.logger.Debug("validating API key",
		zap.Uint("webhook_id", webhookID),
	)

	var webhook models.Webhook
	err := s.db.Preload("User").Where("id = ?", webhookID).First(&webhook).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("webhook not found for API key validation",
				zap.Uint("webhook_id", webhookID),
			)
			return nil, fmt.Errorf("webhook not found")
		}
		return nil, fmt.Errorf("failed to get webhook: %w", err)
	}

	if !webhook.IsActive {
		s.logger.Debug("webhook is inactive",
			zap.Uint("webhook_id", webhookID),
		)
		return nil, fmt.Errorf("webhook is inactive")
	}

	if webhook.ExpiresAt != nil && webhook.ExpiresAt.Before(time.Now()) {
		s.logger.Debug("webhook has expired",
			zap.Uint("webhook_id", webhookID),
			zap.Time("expires_at", *webhook.ExpiresAt),
		)
		return nil, fmt.Errorf("webhook has expired")
	}

	if !s.validateAPIKeyHash(apiKey, webhook.APIKeyHash) {
		s.logger.Debug("invalid API key",
			zap.Uint("webhook_id", webhookID),
		)
		return nil, fmt.Errorf("invalid API key")
	}

	s.logger.Debug("API key validated successfully",
		zap.Uint("webhook_id", webhookID),
		zap.Uint("user_id", webhook.UserID),
	)

	return &webhook, nil
}

func (s *Service) UpdateWebhookUsage(webhookID uint) error {
	now := time.Now()
	return s.db.Model(&models.Webhook{}).
		Where("id = ?", webhookID).
		Updates(map[string]interface{}{
			"last_triggered": now,
			"trigger_count":  gorm.Expr("trigger_count + 1"),
		}).Error
}

func (s *Service) generateAPIKey() (string, error) {

	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return "wh_" + hex.EncodeToString(bytes), nil
}

func (s *Service) hashAPIKey(apiKey string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(apiKey), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (s *Service) validateAPIKeyHash(apiKey, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(apiKey))
	return err == nil
}

func (s *Service) constantTimeCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func (s *Service) ValidateWebhookStackPattern(webhook *models.Webhook, stackName string) error {
	s.logger.Debug("validating webhook stack pattern",
		zap.Uint("webhook_id", webhook.ID),
		zap.String("stack_name", stackName),
		zap.String("stack_pattern", webhook.StackPattern),
	)

	if !utils.MatchesPattern(stackName, webhook.StackPattern) {
		s.logger.Debug("stack name does not match webhook pattern",
			zap.Uint("webhook_id", webhook.ID),
			zap.String("stack_name", stackName),
			zap.String("stack_pattern", webhook.StackPattern),
		)
		return fmt.Errorf("stack name '%s' does not match webhook pattern '%s'", stackName, webhook.StackPattern)
	}

	s.logger.Debug("stack pattern validation successful",
		zap.Uint("webhook_id", webhook.ID),
		zap.String("stack_name", stackName),
		zap.String("stack_pattern", webhook.StackPattern),
	)

	return nil
}

// Admin methods

func (s *Service) GetAllWebhooks() ([]models.WebhookResponse, error) {
	s.logger.Debug("fetching all webhooks for admin view")

	var webhooks []models.Webhook
	result := s.db.Preload("User").Find(&webhooks)
	if result.Error != nil {
		s.logger.Error("failed to fetch all webhooks", zap.Error(result.Error))
		return nil, result.Error
	}

	responses := make([]models.WebhookResponse, len(webhooks))
	for i, webhook := range webhooks {

		var scopes []models.WebhookServerScope
		s.db.Where("webhook_id = ?", webhook.ID).Find(&scopes)

		responses[i] = webhook.ToResponse()
		responses[i].ServerScopes = make([]uint, 0, len(scopes))
		for _, scope := range scopes {
			responses[i].ServerScopes = append(responses[i].ServerScopes, scope.ServerID)
		}

		if webhook.User.ID != 0 {
			responses[i].UserName = webhook.User.Username
			if responses[i].UserName == "" {
				responses[i].UserName = webhook.User.Email
			}
		}
	}

	s.logger.Debug("fetched all webhooks", zap.Int("count", len(responses)))

	return responses, nil
}

func (s *Service) AdminGetWebhook(webhookID uint) (*models.WebhookResponse, error) {
	s.logger.Debug("admin fetching webhook", zap.Uint("webhook_id", webhookID))

	var webhook models.Webhook
	result := s.db.Preload("User").First(&webhook, webhookID)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			s.logger.Debug("webhook not found", zap.Uint("webhook_id", webhookID))
			return nil, gorm.ErrRecordNotFound
		}
		s.logger.Error("failed to fetch webhook", zap.Error(result.Error), zap.Uint("webhook_id", webhookID))
		return nil, result.Error
	}

	var scopes []models.WebhookServerScope
	s.db.Where("webhook_id = ?", webhook.ID).Find(&scopes)

	response := webhook.ToResponse()
	response.ServerScopes = make([]uint, 0, len(scopes))
	for _, scope := range scopes {
		response.ServerScopes = append(response.ServerScopes, scope.ServerID)
	}

	if webhook.User.ID != 0 {
		response.UserName = webhook.User.Username
		if response.UserName == "" {
			response.UserName = webhook.User.Email
		}
	}

	s.logger.Debug("admin fetched webhook", zap.Uint("webhook_id", webhookID))

	return &response, nil
}

func (s *Service) AdminDeleteWebhook(webhookID uint) error {
	s.logger.Info("admin deleting webhook", zap.Uint("webhook_id", webhookID))

	result := s.db.Delete(&models.Webhook{}, webhookID)
	if result.Error != nil {
		s.logger.Error("failed to delete webhook", zap.Error(result.Error), zap.Uint("webhook_id", webhookID))
		return result.Error
	}

	if result.RowsAffected == 0 {
		s.logger.Debug("webhook not found for deletion", zap.Uint("webhook_id", webhookID))
		return gorm.ErrRecordNotFound
	}

	s.logger.Info("webhook deleted successfully", zap.Uint("webhook_id", webhookID))

	return nil
}
