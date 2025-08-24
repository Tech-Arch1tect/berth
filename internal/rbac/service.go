package rbac

import (
	"brx-starter-kit/models"
	"errors"

	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		db: db,
	}
}

func (s *Service) HasRole(userID uint, roleName string) (bool, error) {
	var user models.User
	err := s.db.Preload("Roles", "name = ?", roleName).First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return len(user.Roles) > 0, nil
}

func (s *Service) HasPermission(userID uint, resource, action string) (bool, error) {
	var user models.User
	err := s.db.Preload("Roles", "is_admin = ?", true).First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			return true, nil
		}
	}
	return false, nil
}

func (s *Service) HasPermissionByName(userID uint, permissionName string) (bool, error) {
	var user models.User
	err := s.db.Preload("Roles", "is_admin = ?", true).First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			return true, nil
		}
	}
	return false, nil
}

func (s *Service) AssignRole(userID uint, roleID uint) error {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		return err
	}

	for _, role := range user.Roles {
		if role.ID == roleID {
			return nil
		}
	}

	var role models.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		return err
	}

	return s.db.Model(&user).Association("Roles").Append(&role)
}

func (s *Service) RevokeRole(userID uint, roleID uint) error {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return err
	}

	var role models.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		return err
	}

	return s.db.Model(&user).Association("Roles").Delete(&role)
}

func (s *Service) GetUserRoles(userID uint) ([]models.Role, error) {
	var user models.User
	err := s.db.Preload("Roles").First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []models.Role{}, nil
		}
		return nil, err
	}
	return user.Roles, nil
}

func (s *Service) GetUserPermissions(userID uint) ([]models.Permission, error) {
	return []models.Permission{}, nil
}

func (s *Service) GetRoleByName(roleName string) (*models.Role, error) {
	var role models.Role
	err := s.db.Where("name = ?", roleName).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (s *Service) AssignUserRole(userID uint, roleName string) error {
	role, err := s.GetRoleByName(roleName)
	if err != nil {
		return err
	}
	return s.AssignRole(userID, role.ID)
}
