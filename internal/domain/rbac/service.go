package rbac

import (
	"berth/internal/domain/rbac/permnames"
	usermodel "berth/internal/domain/user"
	"errors"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

var ErrLastAdmin = errors.New("operation would leave the system without an administrator")

type Service struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{
		db:     db,
		logger: logger,
	}
}

func (s *Service) HasRole(userID uint, roleName string) (bool, error) {
	s.logger.Debug("checking user role",
		zap.Uint("user_id", userID),
		zap.String("role_name", roleName),
	)

	var user usermodel.User
	err := s.db.Preload("Roles", "name = ?", roleName).First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("user not found for role check",
				zap.Uint("user_id", userID),
				zap.String("role_name", roleName),
			)
			return false, nil
		}
		s.logger.Error("failed to check user role",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("role_name", roleName),
		)
		return false, err
	}

	hasRole := len(user.Roles) > 0
	s.logger.Debug("user role check completed",
		zap.Uint("user_id", userID),
		zap.String("role_name", roleName),
		zap.Bool("has_role", hasRole),
	)

	return hasRole, nil
}

func (s *Service) AssignRole(userID uint, roleID uint) error {
	s.logger.Info("assigning role to user",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
	)

	var user usermodel.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		s.logger.Error("failed to find user for role assignment",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("role_id", roleID),
		)
		return err
	}

	for _, role := range user.Roles {
		if role.ID == roleID {
			s.logger.Debug("user already has role",
				zap.Uint("user_id", userID),
				zap.Uint("role_id", roleID),
			)
			return nil
		}
	}

	var role usermodel.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		s.logger.Error("failed to find role for assignment",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return err
	}

	if err := s.db.Model(&user).Association("Roles").Append(&role); err != nil {
		s.logger.Error("failed to assign role to user",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("role_id", roleID),
			zap.String("role_name", role.Name),
		)
		return err
	}

	s.logger.Info("role assigned successfully",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
		zap.String("role_name", role.Name),
	)

	return nil
}

func countAdminUsersExcluding(db *gorm.DB, excludeUserID, excludeRoleID uint) (int64, error) {
	var count int64
	err := db.Model(&usermodel.User{}).
		Joins("JOIN user_roles ON user_roles.user_id = users.id").
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("roles.is_admin = ? AND roles.deleted_at IS NULL AND users.deleted_at IS NULL", true).
		Where("NOT (user_roles.user_id = ? AND (? = 0 OR user_roles.role_id = ?))", excludeUserID, excludeRoleID, excludeRoleID).
		Distinct("user_roles.user_id").
		Count(&count).Error
	return count, err
}

func (s *Service) RevokeRole(userID uint, roleID uint) error {
	s.logger.Info("revoking role from user",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
	)

	var user usermodel.User
	if err := s.db.First(&user, userID).Error; err != nil {
		s.logger.Error("failed to find user for role revocation",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return err
	}

	var role usermodel.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		s.logger.Error("failed to find role for revocation",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return err
	}

	if role.IsAdmin {
		remainingAdmins, err := countAdminUsersExcluding(s.db, userID, roleID)
		if err != nil {
			s.logger.Error("failed to count remaining admin users",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.Uint("role_id", roleID),
			)
			return err
		}
		if remainingAdmins == 0 {
			s.logger.Warn("refusing to revoke the last administrator's admin role",
				zap.Uint("user_id", userID),
				zap.Uint("role_id", roleID),
			)
			return ErrLastAdmin
		}
	}

	if err := s.db.Model(&user).Association("Roles").Delete(&role); err != nil {
		s.logger.Error("failed to revoke role from user",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("role_id", roleID),
			zap.String("role_name", role.Name),
		)
		return err
	}

	s.logger.Info("role revoked successfully",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
		zap.String("role_name", role.Name),
	)

	return nil
}

func (s *Service) GetUserRoles(userID uint) ([]usermodel.Role, error) {
	var user usermodel.User
	err := s.db.Preload("Roles").First(&user, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []usermodel.Role{}, nil
		}
		return nil, err
	}
	return user.Roles, nil
}

func (s *Service) GetRoleByName(roleName string) (*usermodel.Role, error) {
	var role usermodel.Role
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

func (s *Service) GetAllRoles() ([]usermodel.Role, error) {
	var roles []usermodel.Role
	err := s.db.Find(&roles).Error
	return roles, err
}

func (s *Service) CreateRole(name, description string) (*usermodel.Role, error) {
	s.logger.Info("creating new role",
		zap.String("name", name),
		zap.String("description", description),
	)

	if name == "" {
		s.logger.Warn("role creation failed: name is required")
		return nil, errors.New("role name is required")
	}

	var existingRole usermodel.Role
	if err := s.db.Where("name = ?", name).First(&existingRole).Error; err == nil {
		s.logger.Warn("role creation failed: name already exists",
			zap.String("name", name),
			zap.Uint("existing_role_id", existingRole.ID),
		)
		return nil, errors.New("role with this name already exists")
	}

	role := usermodel.Role{
		Name:        name,
		Description: description,
		IsAdmin:     false,
	}

	if err := s.db.Create(&role).Error; err != nil {
		s.logger.Error("failed to create role in database",
			zap.Error(err),
			zap.String("name", name),
		)
		return nil, err
	}

	s.logger.Info("role created successfully",
		zap.Uint("role_id", role.ID),
		zap.String("name", name),
	)

	return &role, nil
}

func (s *Service) UpdateRole(roleID uint, name, description string) (*usermodel.Role, error) {
	if name == "" {
		return nil, errors.New("role name is required")
	}

	var role usermodel.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		return nil, err
	}

	if role.IsAdmin {
		return nil, errors.New("cannot modify admin role")
	}

	if role.Name != name {
		var existingRole usermodel.Role
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
	s.logger.Info("deleting role",
		zap.Uint("role_id", roleID),
	)

	var role usermodel.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		s.logger.Error("failed to find role for deletion",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return err
	}

	if role.IsAdmin {
		s.logger.Warn("attempted to delete admin role",
			zap.Uint("role_id", roleID),
			zap.String("role_name", role.Name),
		)
		return errors.New("cannot delete admin role")
	}

	var userCount int64
	if err := s.db.Model(&usermodel.User{}).Joins("JOIN user_roles ON users.id = user_roles.user_id").Where("user_roles.role_id = ?", roleID).Count(&userCount).Error; err != nil {
		s.logger.Error("failed to check role usage before deletion",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return errors.New("failed to check role usage")
	}

	if userCount > 0 {
		s.logger.Warn("cannot delete role that is assigned to users",
			zap.Uint("role_id", roleID),
			zap.String("role_name", role.Name),
			zap.Int64("user_count", userCount),
		)
		return errors.New("cannot delete role that is assigned to users")
	}

	if err := s.db.Where("role_id = ?", roleID).Delete(&usermodel.ServerRoleStackPermission{}).Error; err != nil {
		s.logger.Error("failed to clean up role permissions",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return errors.New("failed to clean up role permissions")
	}

	if err := s.db.Delete(&role).Error; err != nil {
		s.logger.Error("failed to delete role from database",
			zap.Error(err),
			zap.Uint("role_id", roleID),
			zap.String("role_name", role.Name),
		)
		return err
	}

	s.logger.Info("role deleted successfully",
		zap.Uint("role_id", roleID),
		zap.String("role_name", role.Name),
	)

	return nil
}

func (s *Service) CreateRoleStackPermission(roleID uint, serverID uint, stackname string, permissionName string) error {
	s.logger.Info("creating role stack permission",
		zap.Uint("role_id", roleID),
		zap.Uint("server_id", serverID),
		zap.String("stack_pattern", stackname),
		zap.String("permission_name", permissionName),
	)

	var permission usermodel.Permission
	if err := s.db.Where("name = ?", permissionName).First(&permission).Error; err != nil {
		s.logger.Error("permission not found for role assignment",
			zap.Error(err),
			zap.String("permission_name", permissionName),
		)
		return errors.New("permission not found")
	}

	var existing usermodel.ServerRoleStackPermission
	if err := s.db.Where("role_id = ? AND server_id = ? AND stack_pattern = ? AND permission_id = ?",
		roleID, serverID, stackname, permission.ID).First(&existing).Error; err == nil {
		s.logger.Warn("role stack permission already exists",
			zap.Uint("role_id", roleID),
			zap.Uint("server_id", serverID),
			zap.String("stack_pattern", stackname),
			zap.String("permission_name", permissionName),
		)
		return errors.New("permission already exists")
	}

	srsp := usermodel.ServerRoleStackPermission{
		RoleID:       roleID,
		ServerID:     serverID,
		StackPattern: stackname,
		PermissionID: permission.ID,
	}

	if err := s.db.Create(&srsp).Error; err != nil {
		s.logger.Error("failed to create role stack permission",
			zap.Error(err),
			zap.Uint("role_id", roleID),
			zap.Uint("server_id", serverID),
			zap.String("stack_pattern", stackname),
			zap.String("permission_name", permissionName),
		)
		return err
	}

	s.logger.Info("role stack permission created successfully",
		zap.Uint("permission_id", srsp.ID),
		zap.Uint("role_id", roleID),
		zap.Uint("server_id", serverID),
		zap.String("stack_pattern", stackname),
		zap.String("permission_name", permissionName),
	)

	return nil
}

func (s *Service) DeleteRoleStackPermission(permissionID uint) error {
	return s.db.Delete(&usermodel.ServerRoleStackPermission{}, permissionID).Error
}

func (s *Service) GetUserAccessibleStackPatterns(userID uint, serverID uint) ([]string, error) {
	var user usermodel.User
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

	var serverRoleStackPermissions []usermodel.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		return nil, err
	}

	patternSet := make(map[string]bool)
	for _, srsp := range serverRoleStackPermissions {
		if srsp.Permission.Name == permnames.StacksRead {
			patternSet[srsp.StackPattern] = true
		}
	}

	patterns := make([]string, 0, len(patternSet))
	for pattern := range patternSet {
		patterns = append(patterns, pattern)
	}

	return patterns, nil
}
