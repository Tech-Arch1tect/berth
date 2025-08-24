package rbac

import (
	"brx-starter-kit/internal/dto"
	"brx-starter-kit/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"gorm.io/gorm"
)

type APIHandler struct {
	db      *gorm.DB
	rbacSvc *Service
}

func NewAPIHandler(db *gorm.DB, rbacSvc *Service) *APIHandler {
	return &APIHandler{
		db:      db,
		rbacSvc: rbacSvc,
	}
}

func (h *APIHandler) ListUsers(c echo.Context) error {
	var users []models.User
	if err := h.db.Preload("Roles").Find(&users).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch users",
		})
	}

	userInfos := make([]dto.UserInfo, len(users))
	for i, user := range users {
		userInfos[i] = dto.ConvertUserToUserInfo(user)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"users": userInfos,
	})
}

func (h *APIHandler) GetUserRoles(c echo.Context) error {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid user ID",
		})
	}

	var user models.User
	if err := h.db.Preload("Roles").First(&user, uint(userID)).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
	}

	var allRoles []models.Role
	if err := h.db.Find(&allRoles).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch roles",
		})
	}

	userInfo := dto.ConvertUserToUserInfo(user)

	roleInfos := make([]dto.RoleInfo, len(allRoles))
	for i, role := range allRoles {
		roleInfos[i] = dto.RoleInfo{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"user":      userInfo,
		"all_roles": roleInfos,
	})
}

func (h *APIHandler) AssignRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if err := h.rbacSvc.AssignRole(req.UserID, req.RoleID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to assign role",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Role assigned successfully",
	})
}

func (h *APIHandler) RevokeRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if err := h.rbacSvc.RevokeRole(req.UserID, req.RoleID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to revoke role",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Role revoked successfully",
	})
}

func (h *APIHandler) ListRoles(c echo.Context) error {
	roles, err := h.rbacSvc.GetAllRoles()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch roles",
		})
	}

	// Convert to consistent DTO format
	roleInfos := make([]dto.RoleWithPermissions, len(roles))
	for i, role := range roles {
		roleInfos[i] = dto.ConvertRoleToRoleWithPermissions(role)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"roles": roleInfos,
	})
}

func (h *APIHandler) GetCurrentUserPermissions(c echo.Context) error {
	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not found in context",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

	roles, err := h.rbacSvc.GetUserRoles(userModel.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch user roles",
		})
	}

	permissions, err := h.rbacSvc.GetUserPermissions(userModel.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch user permissions",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"roles":       roles,
		"permissions": permissions,
	})
}

func (h *APIHandler) CheckPermission(c echo.Context) error {
	var req struct {
		Resource string `json:"resource"`
		Action   string `json:"action"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
			"error": "User not found in context",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Invalid user type",
		})
	}

	hasPermission, err := h.rbacSvc.HasPermission(userModel.ID, req.Resource, req.Action)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to check permission",
		})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"has_permission": hasPermission,
		"resource":       req.Resource,
		"action":         req.Action,
	})
}

func (h *APIHandler) ListRoleServerPermissions(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("roleId"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid role ID",
		})
	}

	var role models.Role
	if err := h.db.First(&role, uint(roleID)).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, map[string]string{
			"error": "Role not found",
		})
	}

	if role.IsAdmin {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Cannot manage server permissions for admin role",
		})
	}

	var servers []models.Server
	if err := h.db.Find(&servers).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch servers",
		})
	}

	var permissions []models.Permission
	if err := h.db.Find(&permissions).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch permissions",
		})
	}

	var serverRolePermissions []models.ServerRolePermission
	if err := h.db.Where("role_id = ?", roleID).Find(&serverRolePermissions).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch role permissions",
		})
	}

	permissionMap := make(map[uint]map[uint]bool)
	for _, srp := range serverRolePermissions {
		if permissionMap[srp.ServerID] == nil {
			permissionMap[srp.ServerID] = make(map[uint]bool)
		}
		permissionMap[srp.ServerID][srp.PermissionID] = true
	}

	return c.JSON(http.StatusOK, map[string]any{
		"role":             role,
		"servers":          servers,
		"permissions":      permissions,
		"permissionMatrix": permissionMap,
	})
}

func (h *APIHandler) UpdateRoleServerPermissions(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("roleId"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid role ID",
		})
	}

	var req struct {
		ServerID     uint `json:"server_id"`
		PermissionID uint `json:"permission_id"`
		Granted      bool `json:"granted"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Granted {
		var existing models.ServerRolePermission
		result := h.db.Where("server_id = ? AND role_id = ? AND permission_id = ?",
			req.ServerID, roleID, req.PermissionID).First(&existing)

		if result.Error == gorm.ErrRecordNotFound {
			newPermission := models.ServerRolePermission{
				ServerID:     req.ServerID,
				RoleID:       uint(roleID),
				PermissionID: req.PermissionID,
			}
			if err := h.db.Create(&newPermission).Error; err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
					"error": "Failed to grant permission",
				})
			}
		}
	} else {
		if err := h.db.Where("server_id = ? AND role_id = ? AND permission_id = ?",
			req.ServerID, roleID, req.PermissionID).Delete(&models.ServerRolePermission{}).Error; err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
				"error": "Failed to revoke permission",
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Permission updated successfully",
	})
}

func (h *APIHandler) CreateRole(c echo.Context) error {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	role, err := h.rbacSvc.CreateRole(req.Name, req.Description)
	if err != nil {
		if err.Error() == "role with this name already exists" {
			return echo.NewHTTPError(http.StatusConflict, map[string]string{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, role)
}

func (h *APIHandler) UpdateRole(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid role ID",
		})
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	role, err := h.rbacSvc.UpdateRole(uint(roleID), req.Name, req.Description)
	if err != nil {
		switch err.Error() {
		case "cannot modify admin role":
			return echo.NewHTTPError(http.StatusForbidden, map[string]string{
				"error": err.Error(),
			})
		case "role with this name already exists":
			return echo.NewHTTPError(http.StatusConflict, map[string]string{
				"error": err.Error(),
			})
		case "record not found":
			return echo.NewHTTPError(http.StatusNotFound, map[string]string{
				"error": "Role not found",
			})
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, role)
}

func (h *APIHandler) DeleteRole(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, map[string]string{
			"error": "Invalid role ID",
		})
	}

	err = h.rbacSvc.DeleteRole(uint(roleID))
	if err != nil {
		switch err.Error() {
		case "cannot delete admin role":
			return echo.NewHTTPError(http.StatusForbidden, map[string]string{
				"error": err.Error(),
			})
		case "cannot delete role that is assigned to users":
			return echo.NewHTTPError(http.StatusConflict, map[string]string{
				"error": err.Error(),
			})
		case "record not found":
			return echo.NewHTTPError(http.StatusNotFound, map[string]string{
				"error": "Role not found",
			})
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Role deleted successfully",
	})
}
