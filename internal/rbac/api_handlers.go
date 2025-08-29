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
	roleID, err := common.ParseUintParam(c, "roleId")
	if err != nil {
		return err
	}

	var role models.Role
	if err := h.db.First(&role, uint(roleID)).Error; err != nil {
		return common.SendNotFound(c, "role not found")
	}

	if role.IsAdmin {
		return common.SendBadRequest(c, "cannot manage server permissions for admin role")
	}

	var servers []models.Server
	if err := h.db.Find(&servers).Error; err != nil {
		return common.SendInternalError(c, "failed to fetch servers")
	}

	var permissions []models.Permission
	if err := h.db.Find(&permissions).Error; err != nil {
		return common.SendInternalError(c, "failed to fetch permissions")
	}

	var serverRoleStackPermissions []models.ServerRoleStackPermission
	if err := h.db.Where("role_id = ?", roleID).Find(&serverRoleStackPermissions).Error; err != nil {
		return common.SendInternalError(c, "failed to fetch role stack permissions")
	}

	type PermissionRule struct {
		ID           uint   `json:"id"`
		ServerID     uint   `json:"server_id"`
		PermissionID uint   `json:"permission_id"`
		StackPattern string `json:"stack_pattern"`
		IsStackBased bool   `json:"is_stack_based"`
	}

	var permissionRules []PermissionRule

	for _, srsp := range serverRoleStackPermissions {
		permissionRules = append(permissionRules, PermissionRule{
			ID:           srsp.ID,
			ServerID:     srsp.ServerID,
			PermissionID: srsp.PermissionID,
			StackPattern: srsp.StackPattern,
			IsStackBased: true,
		})
	}

	return common.SendSuccess(c, map[string]any{
		"role":            role,
		"servers":         servers,
		"permissions":     permissions,
		"permissionRules": permissionRules,
	})
}

func (h *APIHandler) CreateRoleStackPermission(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "roleId")
	if err != nil {
		return err
	}

	var req struct {
		ServerID     uint   `json:"server_id"`
		PermissionID uint   `json:"permission_id"`
		StackPattern string `json:"stack_pattern"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.ServerID == 0 || req.PermissionID == 0 {
		return common.SendBadRequest(c, "server_id and permission_id are required")
	}

	if req.StackPattern == "" {
		req.StackPattern = "*"
	}

	var existing models.ServerRoleStackPermission
	result := h.db.Where("server_id = ? AND role_id = ? AND permission_id = ? AND stack_pattern = ?",
		req.ServerID, roleID, req.PermissionID, req.StackPattern).First(&existing)

	if result.Error == nil {
		return common.SendBadRequest(c, "Permission already exists for this server and stack pattern")
	}

	permission := models.ServerRoleStackPermission{
		ServerID:     req.ServerID,
		RoleID:       roleID,
		PermissionID: req.PermissionID,
		StackPattern: req.StackPattern,
	}

	if err := h.db.Create(&permission).Error; err != nil {
		return common.SendInternalError(c, "Failed to create role stack permission")
	}

	return common.SendCreated(c, map[string]string{
		"message": "Role stack permission created successfully",
	})
}

func (h *APIHandler) DeleteRoleStackPermission(c echo.Context) error {
	permissionID, err := common.ParseUintParam(c, "permissionId")
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
