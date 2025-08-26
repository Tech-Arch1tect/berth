package setup

import (
	"brx-starter-kit/internal/rbac"
	"brx-starter-kit/models"
	"errors"

	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	rbacSvc *rbac.Service
}

func NewService(db *gorm.DB, rbacSvc *rbac.Service) *Service {
	return &Service{
		db:      db,
		rbacSvc: rbacSvc,
	}
}

func (s *Service) AdminExists() (bool, error) {
	var count int64
	err := s.db.Model(&models.User{}).
		Joins("JOIN user_roles ON users.id = user_roles.user_id").
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("roles.name = ?", "admin").
		Count(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *Service) CreateAdmin(username, email, password string) (*models.User, error) {
	adminExists, err := s.AdminExists()
	if err != nil {
		return nil, err
	}

	if adminExists {
		return nil, errors.New("admin user already exists")
	}

	user := models.User{
		Username: username,
		Email:    email,
		Password: password,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	if err := s.rbacSvc.AssignUserRole(user.ID, "admin"); err != nil {
		s.db.Delete(&user)
		return nil, err
	}

	return &user, nil
}
