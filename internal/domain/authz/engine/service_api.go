package engine

import (
	"errors"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/patterns"

	"gorm.io/gorm"
)

func (e *Engine) PrincipalForUser(userID uint) (authz.Principal, error) {
	var user usermodel.User
	if err := e.db.Preload("Roles").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return authz.Principal{}, errors.New("user not found")
		}
		return authz.Principal{}, err
	}
	isAdmin := false
	for _, role := range user.Roles {
		if role.IsAdmin {
			isAdmin = true
			break
		}
	}
	return authz.NewPrincipal(user.ID, isAdmin, nil), nil
}

func (e *Engine) HasStackPermission(p authz.Principal, serverID uint, stackname, permission string) (bool, error) {
	if p.IsSystem() {
		return true, nil
	}
	if !p.IsAuthenticated() {
		return false, nil
	}

	ok, err := e.checkUserStackPermission(p, serverID, stackname, permission)
	if err != nil || !ok {
		return false, err
	}
	if p.Key() == nil {
		return true, nil
	}
	return checkAPIKeyStackScope(p.Key(), serverID, stackname, permission), nil
}

func (e *Engine) HasServerPermission(p authz.Principal, serverID uint, permission string) (bool, error) {
	if p.IsSystem() {
		return true, nil
	}
	if !p.IsAuthenticated() {
		return false, nil
	}

	ok, err := e.checkUserAnyStackPermission(p, serverID, permission)
	if err != nil || !ok {
		return false, err
	}
	if p.Key() == nil {
		return true, nil
	}
	return checkAPIKeyServerPermission(p.Key(), serverID, permission), nil
}

func (e *Engine) HasServerAccess(p authz.Principal, serverID uint) (bool, error) {
	if p.IsSystem() {
		return true, nil
	}
	if !p.IsAuthenticated() {
		return false, nil
	}

	ok, err := e.checkUserAnyServerGrant(p, serverID)
	if err != nil || !ok {
		return false, err
	}
	if p.Key() == nil {
		return true, nil
	}
	for _, scope := range p.Key().Scopes {
		if scope.ServerID == nil || *scope.ServerID == serverID {
			return true, nil
		}
	}
	return false, nil
}

func (e *Engine) checkUserAnyServerGrant(p authz.Principal, serverID uint) (bool, error) {
	if p.IsAdmin() {
		return true, nil
	}

	var count int64
	err := e.db.Model(&usermodel.ServerRoleStackPermission{}).
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", p.UserID(), serverID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (e *Engine) StackPermissions(p authz.Principal, serverID uint, stackname string) ([]string, error) {
	if !p.IsAuthenticated() || p.IsSystem() {
		return []string{}, nil
	}

	var rolePermissions []string
	if p.IsAdmin() {
		rolePermissions = rbac.AdminStackPermissions()
	} else {
		var srsps []usermodel.ServerRoleStackPermission
		err := e.db.Preload("Permission").
			Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
			Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", p.UserID(), serverID).
			Find(&srsps).Error
		if err != nil {
			return nil, err
		}

		permissionSet := make(map[string]bool)
		for _, srsp := range srsps {
			if patterns.Matches(stackname, srsp.StackPattern) {
				permissionSet[srsp.Permission.Name] = true
			}
		}
		rolePermissions = make([]string, 0, len(permissionSet))
		for permission := range permissionSet {
			rolePermissions = append(rolePermissions, permission)
		}
	}

	if p.Key() == nil {
		return rolePermissions, nil
	}

	keyPermissions := make(map[string]bool)
	for _, scope := range p.Key().Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		if !patterns.Matches(stackname, scope.StackPattern) {
			continue
		}
		keyPermissions[scope.Permission] = true
	}

	filtered := []string{}
	for _, permission := range rolePermissions {
		if keyPermissions[permission] {
			filtered = append(filtered, permission)
		}
	}
	return filtered, nil
}

func (e *Engine) ReachableServerIDs(p authz.Principal) ([]uint, error) {
	if !p.IsAuthenticated() {
		return []uint{}, nil
	}

	var serverIDs []uint
	if p.IsSystem() || p.IsAdmin() {
		if err := e.db.Model(&server.Server{}).Pluck("id", &serverIDs).Error; err != nil {
			return nil, err
		}
	} else {
		ids, _, err := e.computeRoleScope(p)
		if err != nil {
			return nil, err
		}
		serverIDs = ids
	}

	if p.Key() == nil {
		return serverIDs, nil
	}

	for _, scope := range p.Key().Scopes {
		if scope.ServerID == nil {
			return serverIDs, nil
		}
	}

	scoped := make(map[uint]bool)
	for _, scope := range p.Key().Scopes {
		if scope.ServerID != nil {
			scoped[*scope.ServerID] = true
		}
	}
	filtered := []uint{}
	for _, id := range serverIDs {
		if scoped[id] {
			filtered = append(filtered, id)
		}
	}
	return filtered, nil
}
