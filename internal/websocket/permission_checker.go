package websocket

import (
	"context"

	"berth/internal/rbac"
)

type RBACPermissionChecker struct {
	rbacService *rbac.Service
}

func NewRBACPermissionChecker(rbacService *rbac.Service) *RBACPermissionChecker {
	return &RBACPermissionChecker{
		rbacService: rbacService,
	}
}

func (r *RBACPermissionChecker) CanUserAccessServer(ctx context.Context, userID int, serverID int) bool {
	hasAccess, err := r.rbacService.UserHasServerAccess(ctx, uint(userID), uint(serverID))
	if err != nil {
		return false
	}
	return hasAccess
}

func (r *RBACPermissionChecker) CanUserAccessAnyStackWithPermission(ctx context.Context, userID int, serverID int, permission string) bool {
	var permissionName string

	switch permission {
	case "view":
		permissionName = rbac.PermStacksRead
	case "manage":
		permissionName = rbac.PermStacksManage
	default:
		return false
	}

	hasPermission, err := r.rbacService.UserHasAnyStackPermission(ctx, uint(userID), uint(serverID), permissionName)
	if err != nil {
		return false
	}
	return hasPermission
}

func (r *RBACPermissionChecker) HasStackPermission(ctx context.Context, userID int, serverID int, stackname string, permission string) bool {
	var permissionName string

	switch permission {
	case "view":
		permissionName = rbac.PermStacksRead
	case "manage":
		permissionName = rbac.PermStacksManage
	default:
		return false
	}

	hasPermission, err := r.rbacService.UserHasStackPermission(ctx, uint(userID), uint(serverID), stackname, permissionName)
	if err != nil {
		return false
	}
	return hasPermission
}
