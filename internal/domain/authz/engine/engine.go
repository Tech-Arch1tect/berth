package engine

import (
	"fmt"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/patterns"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Engine struct {
	db      *gorm.DB
	logger  *zap.Logger
	auditor AuthorizationAuditor
}

func New(db *gorm.DB, logger *zap.Logger) *Engine {
	return &Engine{db: db, logger: logger}
}

func (e *Engine) SetAuthorizationAuditor(a AuthorizationAuditor) {
	e.auditor = a
}

func (e *Engine) Authorize(p authz.Principal, reqs ...authz.Requirement) (bool, error) {
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

func (e *Engine) evaluate(p authz.Principal, r authz.Requirement) (bool, error) {
	switch r.Kind {
	case authz.KindAuthenticated:
		return e.evalAuthenticated(p, r)
	case authz.KindAdmin:
		return e.evalAdmin(p, r)
	case authz.KindServerAccess:
		return e.evalServerAccess(p, r)
	case authz.KindServer:
		return e.evalServer(p, r)
	case authz.KindStack:
		return e.evalStack(p, r)
	case authz.KindAPIKeyScope:
		return e.evalAPIKeyScope(p, r)
	default:
		return false, fmt.Errorf("authz: unknown requirement kind %d", r.Kind)
	}
}

func (e *Engine) evalAuthenticated(p authz.Principal, _ authz.Requirement) (bool, error) {
	return p.UserID() != 0, nil
}

func (e *Engine) evalAdmin(p authz.Principal, r authz.Requirement) (bool, error) {
	if !p.IsAdmin() {
		return false, nil
	}
	if p.Key() == nil {
		return true, nil
	}
	return checkAPIKeyHasAdminScope(p.Key(), r.Permission), nil
}

func checkAPIKeyHasAdminScope(key *authz.KeyDescriptor, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.Permission == permName {
			return true
		}
	}
	return false
}

func (e *Engine) evalAPIKeyScope(p authz.Principal, r authz.Requirement) (bool, error) {
	if p.Key() == nil {
		return true, nil
	}
	for _, scope := range p.Key().Scopes {
		if scope.Permission == r.Permission {
			return true, nil
		}
	}
	return false, nil
}

func (e *Engine) evalServerAccess(p authz.Principal, r authz.Requirement) (bool, error) {
	return e.evalServerPerm(p, authz.Requirement{
		Kind:       authz.KindServer,
		ServerID:   r.ServerID,
		Permission: permnames.StacksRead,
	})
}

func (e *Engine) evalServer(p authz.Principal, r authz.Requirement) (bool, error) {
	if r.Permission != permnames.StacksRead {
		ok, err := e.evalServerPerm(p, authz.Requirement{
			Kind:       authz.KindServer,
			ServerID:   r.ServerID,
			Permission: permnames.StacksRead,
		})
		if err != nil || !ok {
			return ok, err
		}
	}
	return e.evalServerPerm(p, r)
}

func (e *Engine) evalServerPerm(p authz.Principal, r authz.Requirement) (bool, error) {
	roleOK, err := e.checkUserAnyStackPermission(p, r.ServerID, r.Permission)
	if err != nil {
		return false, err
	}
	if !roleOK {
		return false, nil
	}
	if p.Key() == nil {
		return true, nil
	}
	return checkAPIKeyServerPermission(p.Key(), r.ServerID, r.Permission), nil
}

func (e *Engine) checkUserAnyStackPermission(p authz.Principal, serverID uint, permName string) (bool, error) {
	if p.IsAdmin() {
		return true, nil
	}
	userID := p.UserID()

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

func checkAPIKeyServerPermission(key *authz.KeyDescriptor, serverID uint, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		if scope.Permission == permName {
			return true
		}
	}
	return false
}

func (e *Engine) evalStack(p authz.Principal, r authz.Requirement) (bool, error) {
	if r.Permission != permnames.StacksRead {
		ok, err := e.evalStackPerm(p, authz.Requirement{
			Kind:       authz.KindStack,
			ServerID:   r.ServerID,
			Stack:      r.Stack,
			Permission: permnames.StacksRead,
		})
		if err != nil || !ok {
			return ok, err
		}
	}
	return e.evalStackPerm(p, r)
}

func (e *Engine) evalStackPerm(p authz.Principal, r authz.Requirement) (bool, error) {
	roleOK, err := e.checkUserStackPermission(p, r.ServerID, r.Stack, r.Permission)
	if err != nil {
		return false, err
	}
	if !roleOK {
		return false, nil
	}
	if p.Key() == nil {
		return true, nil
	}
	return checkAPIKeyStackScope(p.Key(), r.ServerID, r.Stack, r.Permission), nil
}

func (e *Engine) checkUserStackPermission(p authz.Principal, serverID uint, stack, permName string) (bool, error) {
	if p.IsAdmin() {
		return true, nil
	}
	userID := p.UserID()

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

func checkAPIKeyStackScope(key *authz.KeyDescriptor, serverID uint, stack, permName string) bool {
	for _, scope := range key.Scopes {
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		if !patterns.Matches(stack, scope.StackPattern) {
			continue
		}
		if scope.Permission == permName {
			return true
		}
	}
	return false
}
