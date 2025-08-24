package rbac

import (
	"brx-starter-kit/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	rbac       *Service
}

func NewHandler(db *gorm.DB, inertiaSvc *inertia.Service, rbac *Service) *Handler {
	return &Handler{
		db:         db,
		inertiaSvc: inertiaSvc,
		rbac:       rbac,
	}
}

func (h *Handler) ListUsers(c echo.Context) error {
	var users []models.User
	if err := h.db.Preload("Roles").Find(&users).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch users")
	}

	return h.inertiaSvc.Render(c, "Admin/Users", map[string]any{
		"title": "User Management",
		"users": users,
	})
}

func (h *Handler) ShowUserRoles(c echo.Context) error {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user ID")
	}

	var user models.User
	if err := h.db.Preload("Roles").First(&user, uint(userID)).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	var allRoles []models.Role
	if err := h.db.Find(&allRoles).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch roles")
	}

	return h.inertiaSvc.Render(c, "Admin/UserRoles", map[string]any{
		"title":    "Manage User Roles",
		"user":     user,
		"allRoles": allRoles,
	})
}

func (h *Handler) AssignRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/users")
	}

	if err := h.rbac.AssignRole(req.UserID, req.RoleID); err != nil {
		session.AddFlashError(c, "Failed to assign role")
		return h.inertiaSvc.Redirect(c, "/admin/users")
	}

	session.AddFlashSuccess(c, "Role assigned successfully")
	return h.inertiaSvc.Redirect(c, "/admin/users/"+strconv.Itoa(int(req.UserID))+"/roles")
}

func (h *Handler) RevokeRole(c echo.Context) error {
	var req struct {
		UserID uint `json:"user_id"`
		RoleID uint `json:"role_id"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/users")
	}

	if err := h.rbac.RevokeRole(req.UserID, req.RoleID); err != nil {
		session.AddFlashError(c, "Failed to revoke role")
		return h.inertiaSvc.Redirect(c, "/admin/users")
	}

	session.AddFlashSuccess(c, "Role revoked successfully")
	return h.inertiaSvc.Redirect(c, "/admin/users/"+strconv.Itoa(int(req.UserID))+"/roles")
}

func (h *Handler) ListRoles(c echo.Context) error {
	roles, err := h.rbac.GetAllRoles()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch roles")
	}

	return h.inertiaSvc.Render(c, "Admin/Roles", map[string]any{
		"title": "Role Management",
		"roles": roles,
	})
}

func (h *Handler) RoleServerPermissions(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid role ID")
	}

	var role models.Role
	if err := h.db.First(&role, uint(roleID)).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "role not found")
	}

	if role.IsAdmin {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot manage server permissions for admin role")
	}

	var servers []models.Server
	if err := h.db.Find(&servers).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch servers")
	}

	var permissions []models.Permission
	if err := h.db.Find(&permissions).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch permissions")
	}

	var serverRolePermissions []models.ServerRolePermission
	if err := h.db.Where("role_id = ?", roleID).Find(&serverRolePermissions).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch role permissions")
	}

	permissionMap := make(map[uint]map[uint]bool)
	for _, srp := range serverRolePermissions {
		if permissionMap[srp.ServerID] == nil {
			permissionMap[srp.ServerID] = make(map[uint]bool)
		}
		permissionMap[srp.ServerID][srp.PermissionID] = true
	}

	return h.inertiaSvc.Render(c, "Admin/RoleServerPermissions", map[string]any{
		"title":            "Role Server Permissions",
		"role":             role,
		"servers":          servers,
		"permissions":      permissions,
		"permissionMatrix": permissionMap,
	})
}

func (h *Handler) UpdateRoleServerPermissions(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid role ID")
	}

	var req struct {
		ServerID     uint `json:"server_id"`
		PermissionID uint `json:"permission_id"`
		Granted      bool `json:"granted"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
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
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to grant permission")
			}
		}
	} else {
		if err := h.db.Where("server_id = ? AND role_id = ? AND permission_id = ?",
			req.ServerID, roleID, req.PermissionID).Delete(&models.ServerRolePermission{}).Error; err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to revoke permission")
		}
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Permission updated successfully",
	})
}

func (h *Handler) CreateRole(c echo.Context) error {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	_, err := h.rbac.CreateRole(req.Name, req.Description)
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	session.AddFlashSuccess(c, "Role created successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func (h *Handler) UpdateRole(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	_, err = h.rbac.UpdateRole(uint(roleID), req.Name, req.Description)
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	session.AddFlashSuccess(c, "Role updated successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func (h *Handler) DeleteRole(c echo.Context) error {
	roleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		session.AddFlashError(c, "Invalid role ID")
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	err = h.rbac.DeleteRole(uint(roleID))
	if err != nil {
		session.AddFlashError(c, err.Error())
		return h.inertiaSvc.Redirect(c, "/admin/roles")
	}

	session.AddFlashSuccess(c, "Role deleted successfully")
	return h.inertiaSvc.Redirect(c, "/admin/roles")
}

func NewRBACHandler(db *gorm.DB, inertiaSvc *inertia.Service, rbacSvc *Service) *Handler {
	return NewHandler(db, inertiaSvc, rbacSvc)
}
