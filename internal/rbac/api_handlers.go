package rbac

import (
	"berth/internal/common"
	"berth/internal/dto"
	"berth/internal/security"
	"berth/models"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/totp"
	"gorm.io/gorm"
)

type APIHandler struct {
	db           *gorm.DB
	rbacSvc      *Service
	totpSvc      *totp.Service
	authSvc      *auth.Service
	auditService *security.AuditService
}

func NewAPIHandler(db *gorm.DB, rbacSvc *Service, totpSvc *totp.Service, authSvc *auth.Service, auditService *security.AuditService) *APIHandler {
	return &APIHandler{
		db:           db,
		rbacSvc:      rbacSvc,
		totpSvc:      totpSvc,
		authSvc:      authSvc,
		auditService: auditService,
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

	return c.JSON(http.StatusOK, ListUsersResponse{
		Success: true,
		Data: ListUsersResponseData{
			Users: userInfos,
		},
	})
}

func (h *APIHandler) CreateUser(c echo.Context) error {
	var req CreateUserRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		return common.SendBadRequest(c, "username, email and password are required")
	}

	if req.Password != req.PasswordConfirm {
		return common.SendBadRequest(c, "passwords do not match")
	}

	if err := h.authSvc.ValidatePassword(req.Password); err != nil {
		return common.SendBadRequest(c, err.Error())
	}

	var existingUser models.User
	if err := h.db.Where("username = ? OR email = ?", req.Username, req.Email).First(&existingUser).Error; err == nil {
		return common.SendBadRequest(c, "user with this username or email already exists")
	}

	hashedPassword, err := h.authSvc.HashPassword(req.Password)
	if err != nil {
		return common.SendInternalError(c, "failed to process password")
	}

	user := models.User{
		Username: req.Username,
		Email:    req.Email,
		Password: hashedPassword,
	}

	if err := h.db.Create(&user).Error; err != nil {
		return common.SendInternalError(c, "failed to create user")
	}

	if h.authSvc.IsEmailVerificationRequired() {
		if err := h.authSvc.RequestEmailVerification(user.Email); err != nil {
			return common.SendInternalError(c, "user created but failed to send verification email")
		}
	}

	if err := h.db.Preload("Roles").First(&user, user.ID).Error; err != nil {
		return common.SendInternalError(c, "failed to load created user")
	}

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogUserManagementEvent(
		security.EventUserCreated,
		actorUserID,
		actorUsername,
		user.ID,
		user.Email,
		c.RealIP(),
		map[string]any{
			"username": user.Username,
		},
	)

	userInfo := dto.ConvertUserToUserInfo(user, h.totpSvc)

	return c.JSON(http.StatusCreated, CreateUserResponse{
		Success: true,
		Data:    userInfo,
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

	return c.JSON(http.StatusOK, GetUserRolesResponse{
		Success: true,
		Data: GetUserRolesResponseData{
			User:     userInfo,
			AllRoles: roleInfos,
		},
	})
}

func (h *APIHandler) AssignRole(c echo.Context) error {
	var req AssignRoleRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	var targetUser models.User
	h.db.First(&targetUser, req.UserID)

	var role models.Role
	h.db.First(&role, req.RoleID)

	if err := h.rbacSvc.AssignRole(req.UserID, req.RoleID); err != nil {
		return common.SendInternalError(c, "Failed to assign role")
	}

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogUserManagementEvent(
		security.EventUserRoleAssigned,
		actorUserID,
		actorUsername,
		req.UserID,
		targetUser.Email,
		c.RealIP(),
		map[string]any{
			"role_id":   req.RoleID,
			"role_name": role.Name,
		},
	)

	return c.JSON(http.StatusOK, AssignRoleResponse{
		Success: true,
		Data:    MessageData{Message: "Role assigned successfully"},
	})
}

func (h *APIHandler) RevokeRole(c echo.Context) error {
	var req RevokeRoleRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	var targetUser models.User
	h.db.First(&targetUser, req.UserID)

	var role models.Role
	h.db.First(&role, req.RoleID)

	if err := h.rbacSvc.RevokeRole(req.UserID, req.RoleID); err != nil {
		return common.SendInternalError(c, "Failed to revoke role")
	}

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogUserManagementEvent(
		security.EventUserRoleRevoked,
		actorUserID,
		actorUsername,
		req.UserID,
		targetUser.Email,
		c.RealIP(),
		map[string]any{
			"role_id":   req.RoleID,
			"role_name": role.Name,
		},
	)

	return c.JSON(http.StatusOK, RevokeRoleResponse{
		Success: true,
		Data:    MessageData{Message: "Role revoked successfully"},
	})
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

	return c.JSON(http.StatusOK, ListRolesResponse{
		Success: true,
		Data: ListRolesResponseData{
			Roles: roleInfos,
		},
	})
}

func (h *APIHandler) CreateRole(c echo.Context) error {
	var req CreateRoleRequest
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

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogRBACEvent(
		security.EventRoleCreated,
		actorUserID,
		actorUsername,
		models.TargetTypeRole,
		role.ID,
		role.Name,
		c.RealIP(),
		map[string]any{
			"description": role.Description,
		},
	)

	return c.JSON(http.StatusCreated, CreateRoleResponse{
		Success: true,
		Data:    dto.ConvertRoleToRoleWithPermissions(*role),
	})
}

func (h *APIHandler) UpdateRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req UpdateRoleRequest
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

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogRBACEvent(
		security.EventRoleUpdated,
		actorUserID,
		actorUsername,
		models.TargetTypeRole,
		role.ID,
		role.Name,
		c.RealIP(),
		map[string]any{
			"description": role.Description,
		},
	)

	return c.JSON(http.StatusOK, UpdateRoleResponse{
		Success: true,
		Data:    dto.ConvertRoleToRoleWithPermissions(*role),
	})
}

func (h *APIHandler) DeleteRole(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var role models.Role
	h.db.First(&role, roleID)
	roleName := role.Name

	if err := h.rbacSvc.DeleteRole(roleID); err != nil {
		return common.SendInternalError(c, "Failed to delete role")
	}

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogRBACEvent(
		security.EventRoleDeleted,
		actorUserID,
		actorUsername,
		models.TargetTypeRole,
		roleID,
		roleName,
		c.RealIP(),
		nil,
	)

	return c.JSON(http.StatusOK, DeleteRoleResponse{
		Success: true,
		Data:    MessageData{Message: "Role deleted successfully"},
	})
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

	roleInfo := dto.RoleInfo{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description,
		IsAdmin:     role.IsAdmin,
	}

	serverInfos := make([]ServerInfo, len(servers))
	for i, s := range servers {
		serverInfos[i] = ServerInfo{
			ID:          s.ID,
			Name:        s.Name,
			Description: s.Description,
			Host:        s.Host,
			Port:        s.Port,
			IsActive:    s.IsActive,
		}
	}

	permissionInfos := make([]dto.PermissionInfo, len(permissions))
	for i, p := range permissions {
		permissionInfos[i] = dto.ConvertPermissionToPermissionInfo(p)
	}

	permissionRules := make([]StackPermissionRule, len(serverRoleStackPermissions))
	for i, srsp := range serverRoleStackPermissions {
		permissionRules[i] = StackPermissionRule{
			ID:           srsp.ID,
			ServerID:     srsp.ServerID,
			PermissionID: srsp.PermissionID,
			StackPattern: srsp.StackPattern,
			IsStackBased: true,
		}
	}

	return c.JSON(http.StatusOK, ListRoleStackPermissionsResponse{
		Success: true,
		Data: ListRoleStackPermissionsData{
			Role:            roleInfo,
			Servers:         serverInfos,
			Permissions:     permissionInfos,
			PermissionRules: permissionRules,
		},
	})
}

func (h *APIHandler) CreateRoleStackPermission(c echo.Context) error {
	roleID, err := common.ParseUintParam(c, "roleId")
	if err != nil {
		return err
	}

	var req CreateStackPermissionRequest
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

	var role models.Role
	h.db.First(&role, roleID)

	var perm models.Permission
	h.db.First(&perm, req.PermissionID)

	var server models.Server
	h.db.First(&server, req.ServerID)

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	h.auditService.LogRBACEvent(
		security.EventPermissionAdded,
		actorUserID,
		actorUsername,
		models.TargetTypePermission,
		permission.ID,
		perm.Name,
		c.RealIP(),
		map[string]any{
			"role_id":       roleID,
			"role_name":     role.Name,
			"server_id":     req.ServerID,
			"server_name":   server.Name,
			"stack_pattern": req.StackPattern,
		},
	)

	return c.JSON(http.StatusCreated, CreateStackPermissionResponse{
		Success: true,
		Data:    MessageData{Message: "Role stack permission created successfully"},
	})
}

func (h *APIHandler) DeleteRoleStackPermission(c echo.Context) error {
	permissionID, err := common.ParseUintParam(c, "permissionId")
	if err != nil {
		return err
	}

	var stackPerm models.ServerRoleStackPermission
	h.db.Preload("Role").Preload("Permission").Preload("Server").First(&stackPerm, permissionID)

	if err := h.rbacSvc.DeleteRoleStackPermission(permissionID); err != nil {
		return common.SendInternalError(c, "Failed to delete role stack permission")
	}

	actorUserID, _ := common.GetCurrentUserID(c)
	actorUser, _ := common.GetCurrentUser(c, h.db)
	actorUsername := ""
	if actorUser != nil {
		actorUsername = actorUser.Username
	}

	permName := ""
	if stackPerm.Permission.Name != "" {
		permName = stackPerm.Permission.Name
	}

	h.auditService.LogRBACEvent(
		security.EventPermissionRemoved,
		actorUserID,
		actorUsername,
		models.TargetTypePermission,
		permissionID,
		permName,
		c.RealIP(),
		map[string]any{
			"role_id":       stackPerm.RoleID,
			"role_name":     stackPerm.Role.Name,
			"server_id":     stackPerm.ServerID,
			"server_name":   stackPerm.Server.Name,
			"stack_pattern": stackPerm.StackPattern,
		},
	)

	return c.JSON(http.StatusOK, DeleteStackPermissionResponse{
		Success: true,
		Data:    MessageData{Message: "Role stack permission deleted successfully"},
	})
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

func (h *APIHandler) ListPermissions(c echo.Context) error {
	permType := c.QueryParam("type")

	query := h.db

	if permType == "role" {
		query = query.Where("is_api_key_only = ?", false)
	}

	var permissions []models.Permission
	if err := query.Find(&permissions).Error; err != nil {
		return common.SendInternalError(c, "Failed to fetch permissions")
	}

	permissionInfos := make([]dto.PermissionInfo, len(permissions))
	for i, p := range permissions {
		permissionInfos[i] = dto.PermissionInfo{
			ID:           p.ID,
			Name:         p.Name,
			Resource:     p.Resource,
			Action:       p.Action,
			Description:  p.Description,
			IsAPIKeyOnly: p.IsAPIKeyOnly,
		}
	}

	return c.JSON(http.StatusOK, ListPermissionsResponse{
		Success: true,
		Data: ListPermissionsResponseData{
			Permissions: permissionInfos,
		},
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
