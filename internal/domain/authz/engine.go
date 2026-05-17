package authz

import (
	"fmt"

	"berth/internal/domain/apikey"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/patterns"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Engine struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewEngine(db *gorm.DB, logger *zap.Logger) *Engine {
	return &Engine{db: db, logger: logger}
}

func (e *Engine) Authorize(p Principal, reqs ...Requirement) (bool, error) {
	if p.IsSystem() {
		return true, nil
	}
	for _, r := range reqs {
		ok, err := e.evaluate(p, r)
		if err != nil {
			return false, err
		}
		if !ok {
			return false, nil
		}
	}
	return true, nil
}

func (e *Engine) evaluate(p Principal, r Requirement) (bool, error) {
	switch r.Kind {
	case KindAuthenticated:
		return e.evalAuthenticated(p, r)
	case KindAdmin:
		return e.evalAdmin(p, r)
	case KindServerAccess:
		return e.evalServerAccess(p, r)
	case KindServer:
		return e.evalServer(p, r)
	case KindStack:
		return e.evalStack(p, r)
	default:
		return false, fmt.Errorf("authz: unknown requirement kind %d", r.Kind)
	}
}

func (e *Engine) evalAuthenticated(p Principal, _ Requirement) (bool, error) {
	return p.UserID != 0, nil
}

func (e *Engine) evalAdmin(p Principal, r Requirement) (bool, error) {
	roleOK := isAdminRole(p.Roles)
	if !roleOK {
		return false, nil
	}
	if p.APIKey == nil {
		return true, nil
	}
	return checkAPIKeyHasAdminScope(p.APIKey, r.Permission), nil
}

func isAdminRole(roles []usermodel.Role) bool {
	for _, role := range roles {
		if role.IsAdmin {
			return true
		}
	}
	return false
}

func checkAPIKeyHasAdminScope(key *apikey.APIKey, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.Permission.Name == permName {
			return true
		}
	}
	return false
}

func (e *Engine) evalServerAccess(p Principal, r Requirement) (bool, error) {
	roleOK, err := e.checkUserServerAccess(p.UserID, p.Roles, r.ServerID)
	if err != nil {
		return false, err
	}
	if !roleOK {
		return false, nil
	}
	if p.APIKey == nil {
		return true, nil
	}
	return checkAPIKeyServerAccess(p.APIKey, r.ServerID), nil
}

func (e *Engine) checkUserServerAccess(userID uint, roles []usermodel.Role, serverID uint) (bool, error) {
	for _, role := range roles {
		if role.IsAdmin {
			return true, nil
		}
	}

	var count int64
	err := e.db.Model(&usermodel.ServerRoleStackPermission{}).
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func checkAPIKeyServerAccess(key *apikey.APIKey, serverID uint) bool {
	for _, scope := range key.Scopes {
		if scope.ServerID == nil || *scope.ServerID == serverID {
			return true
		}
	}
	return false
}

func (e *Engine) evalServer(p Principal, r Requirement) (bool, error) {
	roleOK, err := e.checkUserAnyStackPermission(p.UserID, p.Roles, r.ServerID, r.Permission)
	if err != nil {
		return false, err
	}
	if !roleOK {
		return false, nil
	}
	if p.APIKey == nil {
		return true, nil
	}
	return checkAPIKeyServerPermission(p.APIKey, r.ServerID, r.Permission), nil
}

func (e *Engine) checkUserAnyStackPermission(userID uint, roles []usermodel.Role, serverID uint, permName string) (bool, error) {
	for _, role := range roles {
		if role.IsAdmin {
			return true, nil
		}
	}

	var count int64
	err := e.db.Model(&usermodel.ServerRoleStackPermission{}).
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Joins("JOIN permissions ON permissions.id = server_role_stack_permissions.permission_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ? AND permissions.name = ?", userID, serverID, permName).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func checkAPIKeyServerPermission(key *apikey.APIKey, serverID uint, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		if scope.Permission.Name == permName {
			return true
		}
	}
	return false
}

func (e *Engine) evalStack(p Principal, r Requirement) (bool, error) {
	roleOK, err := e.checkUserStackPermission(p.UserID, p.Roles, r.ServerID, r.Stack, r.Permission)
	if err != nil {
		return false, err
	}
	if !roleOK {
		return false, nil
	}
	if p.APIKey == nil {
		return true, nil
	}
	return checkAPIKeyStackScope(p.APIKey, r.ServerID, r.Stack, r.Permission), nil
}

func (e *Engine) checkUserStackPermission(userID uint, roles []usermodel.Role, serverID uint, stack, permName string) (bool, error) {
	for _, role := range roles {
		if role.IsAdmin {
			return true, nil
		}
	}

	var srsps []usermodel.ServerRoleStackPermission
	err := e.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ? AND server_role_stack_permissions.server_id = ?", userID, serverID).
		Find(&srsps).Error
	if err != nil {
		return false, err
	}

	for _, srsp := range srsps {
		if srsp.Permission.Name == permName && patterns.Matches(stack, srsp.StackPattern) {
			return true, nil
		}
	}
	return false, nil
}

func checkAPIKeyStackScope(key *apikey.APIKey, serverID uint, stack, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		if !patterns.Matches(stack, scope.StackPattern) {
			continue
		}
		if scope.Permission.Name == permName {
			return true
		}
	}
	return false
}
