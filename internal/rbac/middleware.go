package rbac

import (
	"net/http"

	"berth/internal/auth"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/session"
)

type APIKeyScopeChecker interface {
}

type Middleware struct {
	rbac          *Service
	apiKeyService APIKeyScopeChecker
}

func NewMiddleware(rbac *Service) *Middleware {
	return &Middleware{
		rbac: rbac,
	}
}

func (m *Middleware) SetAPIKeyService(apiKeyService APIKeyScopeChecker) {
	m.apiKeyService = apiKeyService
}

func (m *Middleware) RequireRole(roleName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return echo.NewHTTPError(http.StatusUnauthorized, "authentication required")
			}

			userID := session.GetUserID(c)
			if userID == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
			}

			userIDUint, ok := userID.(uint)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid user ID")
			}

			hasRole, err := m.rbac.HasRole(userIDUint, roleName)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to check role")
			}

			if !hasRole {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequirePermission(resource, action string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return echo.NewHTTPError(http.StatusUnauthorized, "authentication required")
			}

			userID := session.GetUserID(c)
			if userID == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
			}

			userIDUint, ok := userID.(uint)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid user ID")
			}

			hasPermission, err := m.rbac.HasPermission(userIDUint, resource, action)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to check permission")
			}

			if !hasPermission {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequirePermissionByName(permissionName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return echo.NewHTTPError(http.StatusUnauthorized, "authentication required")
			}

			userID := session.GetUserID(c)
			if userID == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
			}

			userIDUint, ok := userID.(uint)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid user ID")
			}

			hasPermission, err := m.rbac.HasPermissionByName(userIDUint, permissionName)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to check permission")
			}

			if !hasPermission {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequireRoleJWT(roleName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := jwtshared.GetCurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "User not found in context",
				})
			}

			userModel, ok := user.(models.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "Invalid user type",
				})
			}

			hasRole, err := m.rbac.HasRole(userModel.ID, roleName)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
					"error": "Failed to check role",
				})
			}

			if !hasRole {
				return echo.NewHTTPError(http.StatusForbidden, map[string]string{
					"error": "Insufficient permissions",
				})
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequirePermissionJWT(resource, action string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := jwtshared.GetCurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "User not found in context",
				})
			}

			userModel, ok := user.(models.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "Invalid user type",
				})
			}

			hasPermission, err := m.rbac.HasPermission(userModel.ID, resource, action)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
					"error": "Failed to check permission",
				})
			}

			if !hasPermission {
				return echo.NewHTTPError(http.StatusForbidden, map[string]string{
					"error": "Insufficient permissions",
				})
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequirePermissionByNameJWT(permissionName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := jwtshared.GetCurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "User not found in context",
				})
			}

			userModel, ok := user.(models.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "Invalid user type",
				})
			}

			hasPermission, err := m.rbac.HasPermissionByName(userModel.ID, permissionName)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
					"error": "Failed to check permission",
				})
			}

			if !hasPermission {
				return echo.NewHTTPError(http.StatusForbidden, map[string]string{
					"error": "Insufficient permissions",
				})
			}

			return next(c)
		}
	}
}

func (m *Middleware) RequireAPIKeyDenied() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if auth.IsAPIKeyAuth(c) {
				return echo.NewHTTPError(http.StatusForbidden, map[string]string{
					"error": "API keys cannot access this endpoint",
				})
			}
			return next(c)
		}
	}
}

func (m *Middleware) RequireAdminScopeJWT(scopeName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := jwtshared.GetCurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "User not found in context",
				})
			}

			userModel, ok := user.(models.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "Invalid user type",
				})
			}

			hasRole, err := m.rbac.HasRole(userModel.ID, RoleAdmin)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
					"error": "Failed to check role",
				})
			}

			if !hasRole {
				return echo.NewHTTPError(http.StatusForbidden, map[string]string{
					"error": "Insufficient permissions - admin role required",
				})
			}

			if auth.IsSessionAuth(c) {
				return next(c)
			}

			if auth.IsJWTAuth(c) {
				return next(c)
			}

			if auth.IsAPIKeyAuth(c) {
				apiKey := auth.GetAPIKey(c)
				if apiKey == nil {
					return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
						"error": "API key not found in context",
					})
				}

				if m.apiKeyService == nil {
					return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
						"error": "API key service not configured",
					})
				}

				hasScope := m.checkAPIKeyHasAdminScope(apiKey, scopeName)
				if !hasScope {
					return echo.NewHTTPError(http.StatusForbidden, map[string]string{
						"error": "API key lacks required scope: " + scopeName,
					})
				}

				return next(c)
			}

			return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
				"error": "Invalid authentication type",
			})
		}
	}
}

func (m *Middleware) RequireUserScopeJWT(scopeName string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := jwtshared.GetCurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "User not found in context",
				})
			}

			_, ok := user.(models.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error": "Invalid user type",
				})
			}

			if auth.IsSessionAuth(c) {
				return next(c)
			}

			if auth.IsJWTAuth(c) {
				return next(c)
			}

			if auth.IsAPIKeyAuth(c) {
				apiKey := auth.GetAPIKey(c)
				if apiKey == nil {
					return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
						"error": "API key not found in context",
					})
				}

				if m.apiKeyService == nil {
					return echo.NewHTTPError(http.StatusInternalServerError, map[string]string{
						"error": "API key service not configured",
					})
				}

				hasScope := m.checkAPIKeyHasAdminScope(apiKey, scopeName)
				if !hasScope {
					return echo.NewHTTPError(http.StatusForbidden, map[string]string{
						"error": "API key lacks required scope: " + scopeName,
					})
				}

				return next(c)
			}

			return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
				"error": "Invalid authentication type",
			})
		}
	}
}

func (m *Middleware) checkAPIKeyHasAdminScope(apiKey *models.APIKey, scopeName string) bool {
	for _, scope := range apiKey.Scopes {
		if scope.Permission.Name == scopeName {
			return true
		}
	}
	return false
}
