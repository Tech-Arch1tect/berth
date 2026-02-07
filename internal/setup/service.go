package setup

import (
	"berth/internal/rbac"
	"berth/models"
	"errors"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type roleAssigner interface {
	AssignUserRole(userID uint, roleName string) error
}

type Service struct {
	db      *gorm.DB
	rbacSvc roleAssigner
	logger  *logging.Service
}

func NewService(db *gorm.DB, rbacSvc roleAssigner, logger *logging.Service) *Service {
	return &Service{
		db:      db,
		rbacSvc: rbacSvc,
		logger:  logger,
	}
}

func (s *Service) AdminExists() (bool, error) {
	s.logger.Debug("checking if admin user exists")

	var count int64
	err := s.db.Model(&models.User{}).
		Joins("JOIN user_roles ON users.id = user_roles.user_id").
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("roles.name = ?", rbac.RoleAdmin).
		Count(&count).Error

	if err != nil {
		s.logger.Error("failed to check admin user existence",
			zap.Error(err),
		)
		return false, err
	}

	exists := count > 0
	s.logger.Debug("admin user existence check completed",
		zap.Bool("admin_exists", exists),
		zap.Int64("admin_count", count),
	)

	return exists, nil
}

func (s *Service) CreateAdmin(username, email, password string) (*models.User, error) {
	s.logger.Info("creating admin user",
		zap.String("username", username),
		zap.String("email", email),
	)

	adminExists, err := s.AdminExists()
	if err != nil {
		s.logger.Error("failed to check admin existence during admin creation",
			zap.Error(err),
			zap.String("username", username),
		)
		return nil, err
	}

	if adminExists {
		s.logger.Warn("admin creation attempted but admin already exists",
			zap.String("username", username),
			zap.String("email", email),
		)
		return nil, errors.New("admin user already exists")
	}

	user := models.User{
		Username: username,
		Email:    email,
		Password: password,
	}

	if err := s.db.Create(&user).Error; err != nil {
		s.logger.Error("failed to create admin user",
			zap.Error(err),
			zap.String("username", username),
			zap.String("email", email),
		)
		return nil, err
	}

	s.logger.Debug("admin user created, assigning admin role",
		zap.Uint("user_id", user.ID),
		zap.String("username", username),
	)

	if err := s.rbacSvc.AssignUserRole(user.ID, rbac.RoleAdmin); err != nil {
		s.logger.Error("failed to assign admin role, rolling back user creation",
			zap.Error(err),
			zap.Uint("user_id", user.ID),
			zap.String("username", username),
		)
		s.db.Delete(&user)
		return nil, err
	}

	s.logger.Info("admin user created successfully",
		zap.Uint("user_id", user.ID),
		zap.String("username", username),
		zap.String("email", email),
	)

	return &user, nil
}
