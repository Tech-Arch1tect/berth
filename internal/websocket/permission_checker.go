package websocket

import "brx-starter-kit/internal/rbac"

type RBACPermissionChecker struct {
	rbacService *rbac.Service
}

func NewRBACPermissionChecker(rbacService *rbac.Service) *RBACPermissionChecker {
	return &RBACPermissionChecker{
		rbacService: rbacService,
	}
}

func (r *RBACPermissionChecker) CanUserAccessServer(userID int, serverID int) bool {
	hasAccess, err := r.rbacService.UserHasServerAccess(uint(userID), uint(serverID))
	if err != nil {
		return false
	}
	return hasAccess
}

func (r *RBACPermissionChecker) CanUserAccessAnyStackWithPermission(userID int, serverID int, permission string) bool {
	var permissionName string

	switch permission {
	case "view":
		permissionName = "stacks.read"
	case "manage":
		permissionName = "stacks.manage"
	default:
		return false
	}

	hasPermission, err := r.rbacService.UserHasAnyStackPermission(uint(userID), uint(serverID), permissionName)
	if err != nil {
		return false
	}
	return hasPermission
}

func (r *RBACPermissionChecker) HasStackPermission(userID int, serverID int, stackName string, permission string) bool {
	var permissionName string

	switch permission {
	case "view":
		permissionName = "stacks.read"
	case "manage":
		permissionName = "stacks.manage"
	default:
		return false
	}

	hasPermission, err := r.rbacService.UserHasStackPermission(uint(userID), uint(serverID), stackName, permissionName)
	if err != nil {
		return false
	}
	return hasPermission
}
