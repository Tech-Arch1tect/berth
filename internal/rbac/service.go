package rbac

import (
	"berth/internal/auth"
	"berth/models"
	"berth/utils"
	"context"
	"errors"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	logger *logging.Service
}

func NewService(db *gorm.DB, logger *logging.Service) *Service {
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

	var user models.User
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
	s.logger.Info("assigning role to user",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
	)

	var user models.User
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

	var role models.Role
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

func (s *Service) RevokeRole(userID uint, roleID uint) error {
	s.logger.Info("revoking role from user",
		zap.Uint("user_id", userID),
		zap.Uint("role_id", roleID),
	)

	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		s.logger.Error("failed to find user for role revocation",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return err
	}

	var role models.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		s.logger.Error("failed to find role for revocation",
			zap.Error(err),
			zap.Uint("role_id", roleID),
		)
		return err
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
	s.logger.Info("creating new role",
		zap.String("name", name),
		zap.String("description", description),
	)

	if name == "" {
		s.logger.Warn("role creation failed: name is required")
		return nil, errors.New("role name is required")
	}

	var existingRole models.Role
	if err := s.db.Where("name = ?", name).First(&existingRole).Error; err == nil {
		s.logger.Warn("role creation failed: name already exists",
			zap.String("name", name),
			zap.Uint("existing_role_id", existingRole.ID),
		)
		return nil, errors.New("role with this name already exists")
	}

	role := models.Role{
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
	s.logger.Info("deleting role",
		zap.Uint("role_id", roleID),
	)

	var role models.Role
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
	if err := s.db.Model(&models.User{}).Joins("JOIN user_roles ON users.id = user_roles.user_id").Where("user_roles.role_id = ?", roleID).Count(&userCount).Error; err != nil {
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

	if err := s.db.Where("role_id = ?", roleID).Delete(&models.ServerRoleStackPermission{}).Error; err != nil {
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

func (s *Service) GetUserAccessibleServerIDs(ctx context.Context, userID uint) ([]uint, error) {
	s.logger.Debug("getting user accessible server IDs",
		zap.Uint("user_id", userID),
	)

	serverIDs, err := s.getUserAccessibleServerIDsRBAC(userID)
	if err != nil {
		return nil, err
	}

	apiKey := auth.GetAPIKeyFromContext(ctx)
	if apiKey == nil {
		return serverIDs, nil
	}

	return s.filterServerIDsByAPIKeyScopes(apiKey, serverIDs), nil
}

func (s *Service) getUserAccessibleServerIDsRBAC(userID uint) ([]uint, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("user not found for server access check",
				zap.Uint("user_id", userID),
			)
			return []uint{}, nil
		}
		s.logger.Error("failed to load user for server access check",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return nil, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			var allServerIDs []uint
			err := s.db.Model(&models.Server{}).Pluck("id", &allServerIDs).Error
			if err != nil {
				s.logger.Error("failed to get all server IDs for admin user",
					zap.Error(err),
					zap.Uint("user_id", userID),
				)
				return nil, err
			}
			s.logger.Debug("admin user granted access to all servers",
				zap.Uint("user_id", userID),
				zap.Int("server_count", len(allServerIDs)),
			)
			return allServerIDs, nil
		}
	}

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ?", userID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		s.logger.Error("failed to query user server permissions",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
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

	s.logger.Debug("user accessible servers determined",
		zap.Uint("user_id", userID),
		zap.Int("accessible_server_count", len(serverIDs)),
		zap.Uints("server_ids", serverIDs),
	)

	return serverIDs, nil
}

func (s *Service) filterServerIDsByAPIKeyScopes(apiKey *models.APIKey, serverIDs []uint) []uint {
	for _, scope := range apiKey.Scopes {
		if scope.ServerID == nil {
			return serverIDs
		}
	}

	scopeServerMap := make(map[uint]bool)
	for _, scope := range apiKey.Scopes {
		if scope.ServerID != nil {
			scopeServerMap[*scope.ServerID] = true
		}
	}

	filteredIDs := []uint{}
	for _, serverID := range serverIDs {
		if scopeServerMap[serverID] {
			filteredIDs = append(filteredIDs, serverID)
		}
	}

	return filteredIDs
}

func (s *Service) UserHasStackPermission(ctx context.Context, userID uint, serverID uint, stackname string, permissionName string) (bool, error) {
	s.logger.Debug("checking user stack permission",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("permission_name", permissionName),
	)

	userHasPermission, err := s.checkUserStackPermission(userID, serverID, stackname, permissionName)
	if err != nil {
		return false, err
	}

	apiKey := auth.GetAPIKeyFromContext(ctx)
	if apiKey == nil {
		return userHasPermission, nil
	}

	if !userHasPermission {
		s.logger.Debug("API key denied - user lacks permission",
			zap.Uint("user_id", userID),
			zap.Uint("api_key_id", apiKey.ID),
			zap.String("permission_name", permissionName),
		)
		return false, nil
	}

	hasScope := s.checkAPIKeyStackScope(apiKey, serverID, stackname, permissionName)
	if !hasScope {
		s.logger.Debug("API key denied - lacks required scope",
			zap.Uint("user_id", userID),
			zap.Uint("api_key_id", apiKey.ID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("permission_name", permissionName),
		)
		return false, nil
	}

	s.logger.Debug("API key permission granted",
		zap.Uint("user_id", userID),
		zap.Uint("api_key_id", apiKey.ID),
		zap.String("permission_name", permissionName),
	)
	return true, nil
}

func (s *Service) checkUserStackPermission(userID uint, serverID uint, stackname string, permissionName string) (bool, error) {
	var user models.User
	if err := s.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Debug("user not found for permission check",
				zap.Uint("user_id", userID),
			)
			return false, nil
		}
		s.logger.Error("failed to load user for permission check",
			zap.Error(err),
			zap.Uint("user_id", userID),
		)
		return false, err
	}

	for _, role := range user.Roles {
		if role.IsAdmin {
			s.logger.Debug("admin user granted permission",
				zap.Uint("user_id", userID),
				zap.String("role_name", role.Name),
				zap.String("permission_name", permissionName),
			)
			return true, nil
		}
	}

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&serverRoleStackPermissions).Error

	if err != nil {
		s.logger.Error("failed to query user stack permissions",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return false, err
	}

	for _, srsp := range serverRoleStackPermissions {
		if srsp.Permission.Name == permissionName && utils.MatchesPattern(stackname, srsp.StackPattern) {
			s.logger.Debug("permission granted via role assignment",
				zap.Uint("user_id", userID),
				zap.Uint("server_id", serverID),
				zap.String("stack_name", stackname),
				zap.String("stack_pattern", srsp.StackPattern),
				zap.String("permission_name", permissionName),
			)
			return true, nil
		}
	}

	s.logger.Debug("permission denied",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("permission_name", permissionName),
	)

	return false, nil
}

func (s *Service) checkAPIKeyStackScope(apiKey *models.APIKey, serverID uint, stackname string, permissionName string) bool {
	for _, scope := range apiKey.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}

		if !utils.MatchesPattern(stackname, scope.StackPattern) {
			continue
		}

		if scope.Permission.Name == permissionName {
			return true
		}
	}
	return false
}

func (s *Service) GetUserStackPermissions(ctx context.Context, userID uint, serverID uint, stackname string) ([]string, error) {
	userPermissions, err := s.getUserStackPermissionsRBAC(userID, serverID, stackname)
	if err != nil {
		return nil, err
	}

	apiKey := auth.GetAPIKeyFromContext(ctx)
	if apiKey == nil {
		return userPermissions, nil
	}

	return s.filterPermissionsByAPIKeyScopes(apiKey, serverID, stackname, userPermissions), nil
}

func (s *Service) getUserStackPermissionsRBAC(userID uint, serverID uint, stackname string) ([]string, error) {
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

func (s *Service) filterPermissionsByAPIKeyScopes(apiKey *models.APIKey, serverID uint, stackname string, userPermissions []string) []string {
	apiKeyPermissions := make(map[string]bool)
	for _, scope := range apiKey.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}

		if !utils.MatchesPattern(stackname, scope.StackPattern) {
			continue
		}

		apiKeyPermissions[scope.Permission.Name] = true
	}

	filteredPermissions := []string{}
	for _, perm := range userPermissions {
		if apiKeyPermissions[perm] {
			filteredPermissions = append(filteredPermissions, perm)
		}
	}

	return filteredPermissions
}

func (s *Service) UserHasServerAccess(ctx context.Context, userID uint, serverID uint) (bool, error) {
	userHasAccess, err := s.checkUserServerAccess(userID, serverID)
	if err != nil {
		return false, err
	}

	apiKey := auth.GetAPIKeyFromContext(ctx)
	if apiKey == nil {
		return userHasAccess, nil
	}

	if !userHasAccess {
		return false, nil
	}

	hasServerScope := s.checkAPIKeyServerAccess(apiKey, serverID)
	return hasServerScope, nil
}

func (s *Service) checkUserServerAccess(userID uint, serverID uint) (bool, error) {
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

func (s *Service) checkAPIKeyServerAccess(apiKey *models.APIKey, serverID uint) bool {
	for _, scope := range apiKey.Scopes {
		if scope.ServerID == nil || *scope.ServerID == serverID {
			return true
		}
	}
	return false
}

func (s *Service) UserHasAnyStackPermission(ctx context.Context, userID uint, serverID uint, permissionName string) (bool, error) {
	userHasPermission, err := s.checkUserAnyStackPermission(userID, serverID, permissionName)
	if err != nil {
		return false, err
	}

	apiKey := auth.GetAPIKeyFromContext(ctx)
	if apiKey == nil {
		return userHasPermission, nil
	}

	if !userHasPermission {
		return false, nil
	}

	hasScope := s.checkAPIKeyServerPermission(apiKey, serverID, permissionName)
	return hasScope, nil
}

func (s *Service) checkUserAnyStackPermission(userID uint, serverID uint, permissionName string) (bool, error) {
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

func (s *Service) checkAPIKeyServerPermission(apiKey *models.APIKey, serverID uint, permissionName string) bool {
	for _, scope := range apiKey.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}

		if scope.Permission.Name == permissionName {
			return true
		}
	}
	return false
}

func (s *Service) CheckUserStackPermission(ctx context.Context, userID uint, serverID uint, stackname string, permissionName string) (bool, error) {
	return s.UserHasStackPermission(ctx, userID, serverID, stackname, permissionName)
}

func (s *Service) GetRoleServerStackPermissions(roleID uint) ([]models.ServerRoleStackPermission, error) {
	var permissions []models.ServerRoleStackPermission
	err := s.db.Preload("Permission").Where("role_id = ?", roleID).Find(&permissions).Error
	return permissions, err
}

func (s *Service) CreateRoleStackPermission(roleID uint, serverID uint, stackname string, permissionName string) error {
	s.logger.Info("creating role stack permission",
		zap.Uint("role_id", roleID),
		zap.Uint("server_id", serverID),
		zap.String("stack_pattern", stackname),
		zap.String("permission_name", permissionName),
	)

	var permission models.Permission
	if err := s.db.Where("name = ?", permissionName).First(&permission).Error; err != nil {
		s.logger.Error("permission not found for role assignment",
			zap.Error(err),
			zap.String("permission_name", permissionName),
		)
		return errors.New("permission not found")
	}

	var existing models.ServerRoleStackPermission
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

	srsp := models.ServerRoleStackPermission{
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
