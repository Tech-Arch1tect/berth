package rbac

import (
	"berth/internal/common"
	"berth/internal/security"
	"berth/models"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	rbac       *Service
	authSvc    *auth.Service
	totpSvc    *totp.Service
	auditSvc   *security.AuditService
}

func NewHandler(db *gorm.DB, inertiaSvc *inertia.Service, rbac *Service, authSvc *auth.Service, totpSvc *totp.Service, auditSvc *security.AuditService) *Handler {
	return &Handler{
		db:         db,
		inertiaSvc: inertiaSvc,
		rbac:       rbac,
		authSvc:    authSvc,
		totpSvc:    totpSvc,
		auditSvc:   auditSvc,
	}
}

func (h *Handler) ListUsers(c echo.Context) error {
	var users []models.User
	if err := h.db.Preload("Roles").Find(&users).Error; err != nil {
		return common.SendInternalError(c, "failed to fetch users")
	}

	type UserWithTOTP struct {
		models.User
		TOTPEnabled bool `json:"totp_enabled"`
	}

	var usersWithTOTP []UserWithTOTP
	for _, user := range users {
		usersWithTOTP = append(usersWithTOTP, UserWithTOTP{
			User:        user,
			TOTPEnabled: h.totpSvc.IsUserTOTPEnabled(user.ID),
		})
	}

	return h.inertiaSvc.Render(c, "Admin/Users", map[string]any{
		"title": "User Management",
		"users": usersWithTOTP,
	})
}

func (h *Handler) ShowUserRoles(c echo.Context) error {
	userID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var user models.User
	if err := h.db.Preload("Roles").First(&user, uint(userID)).Error; err != nil {
		return common.SendNotFound(c, "user not found")
	}

	var allRoles []models.Role
	if err := h.db.Find(&allRoles).Error; err != nil {
		return common.SendInternalError(c, "failed to fetch roles")
	}

	return h.inertiaSvc.Render(c, "Admin/UserRoles", map[string]any{
		"title":    "Manage User Roles",
		"user":     user,
		"allRoles": allRoles,
	})
}

func (h *Handler) ListRoles(c echo.Context) error {
	roles, err := h.rbac.GetAllRoles()
	if err != nil {
		return common.SendInternalError(c, "failed to fetch roles")
	}

	return h.inertiaSvc.Render(c, "Admin/Roles", map[string]any{
		"title": "Role Management",
		"roles": roles,
	})
}

func (h *Handler) CreateRole(c echo.Context) error {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	role, err := h.rbac.CreateRole(req.Name, req.Description)
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogRBACEvent(
			security.EventRoleCreated,
			actorUser.ID,
			actorUser.Username,
			models.TargetTypeRole,
			role.ID,
			role.Name,
			c.RealIP(),
			map[string]any{
				"description": role.Description,
			},
		)
	}

	session.AddFlashSuccess(c, "Role created successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func (h *Handler) UpdateRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	role, err := h.rbac.UpdateRole(uint(roleID), req.Name, req.Description)
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogRBACEvent(
			security.EventRoleUpdated,
			actorUser.ID,
			actorUser.Username,
			models.TargetTypeRole,
			role.ID,
			role.Name,
			c.RealIP(),
			map[string]any{
				"description": role.Description,
			},
		)
	}

	session.AddFlashSuccess(c, "Role updated successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func (h *Handler) DeleteRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	var role models.Role
	if err := h.db.First(&role, uint(roleID)).Error; err != nil {
		session.AddFlashError(c, "Role not found")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	err = h.rbac.DeleteRole(uint(roleID))
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogRBACEvent(
			security.EventRoleDeleted,
			actorUser.ID,
			actorUser.Username,
			models.TargetTypeRole,
			role.ID,
			role.Name,
			c.RealIP(),
			nil,
		)
	}

	session.AddFlashSuccess(c, "Role deleted successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func (h *Handler) RoleServerStackPermissions(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
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
	if err := h.db.Where("is_api_key_only = ?", false).Find(&permissions).Error; err != nil {
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

	return h.inertiaSvc.Render(c, "Admin/RoleStackPermissions", map[string]any{
		"title":           "Role Stack Permissions",
		"role":            role,
		"servers":         servers,
		"permissions":     permissions,
		"permissionRules": permissionRules,
	})
}

func (h *Handler) CreateRoleStackPermission(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	var req struct {
		ServerID     uint   `json:"server_id"`
		PermissionID uint   `json:"permission_id"`
		StackPattern string `json:"stack_pattern"`
	}

	if err := common.BindRequest(c, &req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	if req.StackPattern == "" {
		req.StackPattern = "*"
	}

	var existing models.ServerRoleStackPermission
	result := h.db.Where("server_id = ? AND role_id = ? AND permission_id = ? AND stack_pattern = ?",
		req.ServerID, roleID, req.PermissionID, req.StackPattern).First(&existing)

	if result.Error != gorm.ErrRecordNotFound {
		session.AddFlashError(c, "Permission rule already exists")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	newPermission := models.ServerRoleStackPermission{
		ServerID:     req.ServerID,
		RoleID:       uint(roleID),
		PermissionID: req.PermissionID,
		StackPattern: req.StackPattern,
	}

	if err := h.db.Create(&newPermission).Error; err != nil {
		session.AddFlashError(c, "Failed to create permission rule")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		var role models.Role
		var server models.Server
		var permission models.Permission
		h.db.First(&role, roleID)
		h.db.First(&server, req.ServerID)
		h.db.First(&permission, req.PermissionID)

		_ = h.auditSvc.LogRBACEvent(
			security.EventPermissionAdded,
			actorUser.ID,
			actorUser.Username,
			models.TargetTypeRole,
			role.ID,
			role.Name,
			c.RealIP(),
			map[string]any{
				"permission":    permission.Name,
				"server_id":     server.ID,
				"server_name":   server.Name,
				"stack_pattern": req.StackPattern,
			},
		)
	}

	session.AddFlashSuccess(c, "Permission rule created successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
}

func (h *Handler) DeleteRoleStackPermission(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	permissionID, err := common.ParseUintParam(c, "permissionId")
	if err != nil {
		session.AddFlashError(c, "Invalid permission ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	var permission models.ServerRoleStackPermission
	if err := h.db.First(&permission, uint(permissionID)).Error; err != nil {
		session.AddFlashError(c, "Permission rule not found")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	var role models.Role
	var server models.Server
	var perm models.Permission
	h.db.First(&role, roleID)
	h.db.First(&server, permission.ServerID)
	h.db.First(&perm, permission.PermissionID)

	if err := h.db.Delete(&permission).Error; err != nil {
		session.AddFlashError(c, "Failed to delete permission rule")
		return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogRBACEvent(
			security.EventPermissionRemoved,
			actorUser.ID,
			actorUser.Username,
			models.TargetTypeRole,
			role.ID,
			role.Name,
			c.RealIP(),
			map[string]any{
				"permission":    perm.Name,
				"server_id":     server.ID,
				"server_name":   server.Name,
				"stack_pattern": permission.StackPattern,
			},
		)
	}

	session.AddFlashSuccess(c, "Permission rule deleted successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles/"+strconv.Itoa(int(roleID))+"/stack-permissions")
}

func NewRBACHandler(db *gorm.DB, inertiaSvc *inertia.Service, rbacSvc *Service, authSvc *auth.Service, totpSvc *totp.Service, auditSvc *security.AuditService) *Handler {
	return NewHandler(db, inertiaSvc, rbacSvc, authSvc, totpSvc, auditSvc)
}
