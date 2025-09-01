package rbac

import (
	"berth/models"
	"berth/utils"
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

func (s *Service) GetUserPermissions(userID uint) ([]models.ServerRoleStackPermission, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []models.ServerRoleStackPermission{}, nil
		}
		return nil, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			var allPermissions []models.ServerRoleStackPermission
			err := s.db.Preload("Permission").Find(&allPermissions).Error
			return allPermissions, err
		}
	}

	var permissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ?", userID).
		Find(&permissions).Error

	return permissions, err
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

	if err := s.db.Where("role_id = ?", roleID).Delete(&models.ServerRoleStackPermission{}).Error; err != nil {
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

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ?", userID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		return nil, err
	}

	var serverIDs []uint
	serverIDMap := make(map[uint]bool)

	for _, srsp := range serverRoleStackPermissions {
		if srsp.Permission.Name == "stacks.read" {
			if !serverIDMap[srsp.ServerID] {
				serverIDs = append(serverIDs, srsp.ServerID)
				serverIDMap[srsp.ServerID] = true
			}
		}
	}

	return serverIDs, nil
}

func (s *Service) UserHasStackPermission(userID uint, serverID uint, stackname string, permissionName string) (bool, error) {
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

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		return false, err
	}

	for _, srsp := range serverRoleStackPermissions {
		if srsp.Permission.Name == permissionName && utils.MatchesPattern(stackname, srsp.StackPattern) {
			return true, nil
		}
	}

	return false, nil
}

func (s *Service) GetUserStackPermissions(userID uint, serverID uint, stackname string) ([]string, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []string{}, nil
		}
		return nil, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			return []string{"stacks.read", "stacks.manage", "files.read", "files.write", "logs.read"}, nil
		}
	}

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		return nil, err
	}

	permissionSet := make(map[string]bool)
	for _, srsp := range serverRoleStackPermissions {
		if utils.MatchesPattern(stackname, srsp.StackPattern) {
			permissionSet[srsp.Permission.Name] = true
		}
	}

	permissions := make([]string, 0, len(permissionSet))
	for permission := range permissionSet {
		permissions = append(permissions, permission)
	}

	return permissions, nil
}

func (s *Service) UserHasServerAccess(userID uint, serverID uint) (bool, error) {
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

	var count int64
	err := s.db.Model(&models.ServerRoleStackPermission{}).
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Count(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *Service) UserHasAnyStackPermission(userID uint, serverID uint, permissionName string) (bool, error) {
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

	var count int64
	err := s.db.Model(&models.ServerRoleStackPermission{}).
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Joins("JOIN permissions ON permissions.id = server_role_stack_permissions.permission_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ? AND permissions.name = ?", userID, serverID, permissionName).
		Count(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *Service) CheckUserStackPermission(userID uint, serverID uint, stackname string, permissionName string) (bool, error) {
	return s.UserHasStackPermission(userID, serverID, stackname, permissionName)
}

func (s *Service) GetRoleServerStackPermissions(roleID uint) ([]models.ServerRoleStackPermission, error) {
	var permissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").Where("role_id = ?", roleID).Find(&permissions).Error
	return permissions, err
}

func (s *Service) CreateRoleStackPermission(roleID uint, serverID uint, stackname string, permissionName string) error {
	var permission models.Permission
	if err := s.db.Where("name = ?", permissionName).First(&permission).Error; err != nil {
		return errors.New("permission not found")
	}

	var existing models.ServerRoleStackPermission
	if err := s.db.Where("role_id = ? AND server_id = ? AND stack_pattern = ? AND permission_id = ?",
		roleID, serverID, stackname, permission.ID).First(&existing).Error; err == nil {
		return errors.New("permission already exists")
	}

	srsp := models.ServerRoleStackPermission{
		RoleID:       roleID,
		ServerID:     serverID,
		StackPattern: stackname,
		PermissionID: permission.ID,
	}

	return s.db.Create(&srsp).Error
}

func (s *Service) DeleteRoleStackPermission(permissionID uint) error {
	return s.db.Delete(&models.ServerRoleStackPermission{}, permissionID).Error
}

func (s *Service) GetUserAccessibleStackPatterns(userID uint, serverID uint) ([]string, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []string{}, nil
		}
		return nil, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			return []string{"*"}, nil
		}
	}

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		return nil, err
	}

	patternSet := make(map[string]bool)
	for _, srsp := range serverRoleStackPermissions {
		if srsp.Permission.Name == "stacks.read" {
			patternSet[srsp.StackPattern] = true
		}
	}

	patterns := make([]string, 0, len(patternSet))
	for pattern := range patternSet {
		patterns = append(patterns, pattern)
	}

	return patterns, nil
}
