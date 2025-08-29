package rbac

import (
	"brx-starter-kit/internal/common"
	"brx-starter-kit/internal/dto"
	"brx-starter-kit/models"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/totp"
	"gorm.io/gorm"
)

type APIHandler struct {
	db      *gorm.DB
	rbacSvc *Service
	totpSvc *totp.Service
}

func NewAPIHandler(db *gorm.DB, rbacSvc *Service, totpSvc *totp.Service) *APIHandler {
	return &APIHandler{
		db:      db,
		rbacSvc: rbacSvc,
		totpSvc: totpSvc,
	}
}

func (h *APIHandler) ListUsers(c echo.Context) error {
	var users []models.User
	if err := h.db.Preload("Roles").Find(&users).Error; err != nil {
		return common.SendInternalError(c, "Failed to fetch users")
	}

	userInfos := make([]dto.UserInfo, len(users))
	for i, user := range users {
		userInfos[i] = dto.ConvertUserToUserInfo(user, h.totpSvc)
	}

	return common.SendSuccess(c, map[string]any{
		"users": userInfos,
	})
}

func (h *APIHandler) GetUserRoles(c echo.Context) error {
	userID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var user models.User
	if err := h.db.Preload("Roles").First(&user, userID).Error; err != nil {
		return common.SendNotFound(c, "User not found")
	}

	var allRoles []models.Role
	if err := h.db.Find(&allRoles).Error; err != nil {
		return common.SendInternalError(c, "Failed to fetch roles")
	}

	userInfo := dto.ConvertUserToUserInfo(user, h.totpSvc)

	roleInfos := make([]dto.RoleInfo, len(allRoles))
	for i, role := range allRoles {
		roleInfos[i] = dto.RoleInfo{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
		}
	}

	return common.SendSuccess(c, map[string]any{
		"user":      userInfo,
		"all_roles": roleInfos,
	})
}

func (h *APIHandler) AssignRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if err := h.rbacSvc.AssignRole(req.UserID, req.RoleID); err != nil {
		return common.SendInternalError(c, "Failed to assign role")
	}

	return common.SendMessage(c, "Role assigned successfully")
}

func (h *APIHandler) RevokeRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if err := h.rbacSvc.RevokeRole(req.UserID, req.RoleID); err != nil {
		return common.SendInternalError(c, "Failed to revoke role")
	}

	return common.SendMessage(c, "Role revoked successfully")
}

func (h *APIHandler) ListRoles(c echo.Context) error {
	roles, err := h.rbacSvc.GetAllRoles()
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch roles")
	}

	roleInfos := make([]dto.RoleWithPermissions, len(roles))
	for i, role := range roles {
		roleInfos[i] = dto.ConvertRoleToRoleWithPermissions(role)
	}

	return common.SendSuccess(c, map[string]any{
		"roles": roleInfos,
	})
}

func (h *APIHandler) CreateRole(c echo.Context) error {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Name == "" {
		return common.SendBadRequest(c, "name is required")
	}

	role, err := h.rbacSvc.CreateRole(req.Name, req.Description)
	if err != nil {
		return common.SendInternalError(c, "Failed to create role")
	}

	return common.SendCreated(c, dto.ConvertRoleToRoleWithPermissions(*role))
}

func (h *APIHandler) UpdateRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Name == "" {
		return common.SendBadRequest(c, "name is required")
	}

	role, err := h.rbacSvc.UpdateRole(roleID, req.Name, req.Description)
	if err != nil {
		return common.SendInternalError(c, "Failed to update role")
	}

	return common.SendSuccess(c, dto.ConvertRoleToRoleWithPermissions(*role))
}

func (h *APIHandler) DeleteRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	if err := h.rbacSvc.DeleteRole(roleID); err != nil {
		return common.SendInternalError(c, "Failed to delete role")
	}

	return common.SendMessage(c, "Role deleted successfully")
}

func (h *APIHandler) ListRoleServerStackPermissions(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	permissions, err := h.rbacSvc.GetRoleServerStackPermissions(roleID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch role permissions")
	}

	return common.SendSuccess(c, map[string]any{
		"permissions": permissions,
	})
}

func (h *APIHandler) CreateRoleStackPermission(c echo.Context) error {
	var req struct {
		RoleID     uint   `json:"role_id"`
		ServerID   uint   `json:"server_id"`
		StackName  string `json:"stack_name"`
		Permission string `json:"permission"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.RoleID == 0 || req.ServerID == 0 || req.Permission == "" {
		return common.SendBadRequest(c, "role_id, server_id, and permission are required")
	}

	if !isValidPermission(req.Permission) {
		return common.SendBadRequest(c, "invalid permission type")
	}

	if err := h.rbacSvc.CreateRoleStackPermission(req.RoleID, req.ServerID, req.StackName, req.Permission); err != nil {
		return common.SendInternalError(c, "Failed to create role stack permission")
	}

	return common.SendMessage(c, "Role stack permission created successfully")
}

func (h *APIHandler) DeleteRoleStackPermission(c echo.Context) error {
	permissionID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	if err := h.rbacSvc.DeleteRoleStackPermission(permissionID); err != nil {
		return common.SendInternalError(c, "Failed to delete role stack permission")
	}

	return common.SendMessage(c, "Role stack permission deleted successfully")
}

func (h *APIHandler) GetUserPermissions(c echo.Context) error {
	userID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	permissions, err := h.rbacSvc.GetUserPermissions(userID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch permissions")
	}

	return common.SendSuccess(c, map[string]any{
		"permissions": permissions,
	})
}

func isValidPermission(permission string) bool {
	validPermissions := []string{
		"read",
		"files.read",
		"files.write",
		"stacks.read",
		"stacks.manage",
		"containers.read",
		"containers.manage",
		"logs.read",
	}
	for _, valid := range validPermissions {
		if strings.EqualFold(permission, valid) {
			return true
		}
	}
	return false
}
