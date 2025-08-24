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

func (s *Service) GetAllRoles() ([]models.Role, error) {
	var roles []models.Role
	err := s.db.Find(&roles).Error
	return roles, err
}

func (s *Service) CreateRole(name, description string) (*models.Role, error) {
	if name == "" {
		return nil, errors.New("role name is required")
	}

	var existingRole models.Role
	if err := s.db.Where("name = ?", name).First(&existingRole).Error; err == nil {
		return nil, errors.New("role with this name already exists")
	}

	role := models.Role{
		Name:        name,
		Description: description,
		IsAdmin:     false,
	}

	if err := s.db.Create(&role).Error; err != nil {
		return nil, err
	}

	return &role, nil
}

func (s *Service) UpdateRole(roleID uint, name, description string) (*models.Role, error) {
	if name == "" {
		return nil, errors.New("role name is required")
	}

	var role models.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		return nil, err
	}

	if role.IsAdmin {
		return nil, errors.New("cannot modify admin role")
	}

	if role.Name != name {
		var existingRole models.Role
		if err := s.db.Where("name = ? AND id != ?", name, roleID).First(&existingRole).Error; err == nil {
			return nil, errors.New("role with this name already exists")
		}
	}

	role.Name = name
	role.Description = description

	if err := s.db.Save(&role).Error; err != nil {
		return nil, err
	}

	return &role, nil
}

func (s *Service) DeleteRole(roleID uint) error {
	var role models.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		return err
	}

	if role.IsAdmin {
		return errors.New("cannot delete admin role")
	}

	var userCount int64
	if err := s.db.Model(&models.User{}).Joins("JOIN user_roles ON users.id = user_roles.user_id").Where("user_roles.role_id = ?", roleID).Count(&userCount).Error; err != nil {
		return errors.New("failed to check role usage")
	}

	if userCount > 0 {
		return errors.New("cannot delete role that is assigned to users")
	}

	if err := s.db.Where("role_id = ?", roleID).Delete(&models.ServerRolePermission{}).Error; err != nil {
		return errors.New("failed to clean up role permissions")
	}

	if err := s.db.Delete(&role).Error; err != nil {
		return err
	}

	return nil
}

func (s *Service) GetUserAccessibleServerIDs(userID uint) ([]uint, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []uint{}, nil
		}
		return nil, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			var allServerIDs []uint
			err := s.db.Model(&models.Server{}).Pluck("id", &allServerIDs).Error
			return allServerIDs, err
		}
	}

	var serverRolePermissions []models.ServerRolePermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_permissions.role_id").
		Where("user_roles.user_id = ?", userID).
		Find(&serverRolePermissions).Error

	if err != nil {
		return nil, err
	}

	var serverIDs []uint
	serverIDMap := make(map[uint]bool)

	for _, srp := range serverRolePermissions {
		if srp.Permission.Name == "stacks.read" {
			if !serverIDMap[srp.ServerID] {
				serverIDs = append(serverIDs, srp.ServerID)
				serverIDMap[srp.ServerID] = true
			}
		}
	}

	return serverIDs, nil
}

func (s *Service) UserHasServerPermission(userID uint, serverID uint, permissionName string) (bool, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
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

	var serverRolePermissions []models.ServerRolePermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_permissions.server_id = ?", userID, serverID).
		Find(&serverRolePermissions).Error

	if err != nil {
		return false, err
	}

	for _, srp := range serverRolePermissions {
		if srp.Permission.Name == permissionName {
			return true, nil
		}
	}

	return false, nil
}
