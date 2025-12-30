package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type UserInfo struct {
	ID              uint       `json:"id"`
	Username        string     `json:"username"`
	Email           string     `json:"email"`
	EmailVerifiedAt *string    `json:"email_verified_at"`
	LastLoginAt     *string    `json:"last_login_at"`
	TOTPEnabled     bool       `json:"totp_enabled"`
	CreatedAt       string     `json:"created_at"`
	UpdatedAt       string     `json:"updated_at"`
	Roles           []RoleInfo `json:"roles"`
}

type RoleInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsAdmin     bool   `json:"is_admin"`
}

type RoleWithPermissions struct {
	ID          uint             `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	IsAdmin     bool             `json:"is_admin"`
	Permissions []PermissionInfo `json:"permissions"`
}

type PermissionInfo struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Resource     string `json:"resource"`
	Action       string `json:"action"`
	Description  string `json:"description"`
	IsAPIKeyOnly bool   `json:"is_api_key_only"`
}

type UsersListResponse struct {
	Users []UserInfo `json:"users"`
}

type UserRolesResponse struct {
	User     UserInfo   `json:"user"`
	AllRoles []RoleInfo `json:"all_roles"`
}

type RolesListResponse struct {
	Roles []RoleWithPermissions `json:"roles"`
}

type PermissionsListResponse struct {
	Permissions []PermissionInfo `json:"permissions"`
}

type StackPermissionsResponse struct {
	Role            map[string]interface{}   `json:"role"`
	Servers         []map[string]interface{} `json:"servers"`
	Permissions     []PermissionInfo         `json:"permissions"`
	PermissionRules []map[string]interface{} `json:"permissionRules"`
}

func TestRBACUsersEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacadminuser",
		Email:    "rbacadminuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/users returns users list", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var usersResp UsersListResponse
		require.NoError(t, resp.GetJSON(&usersResp))
		assert.NotEmpty(t, usersResp.Users)
	})

	var createdUserID uint

	t.Run("POST /api/v1/admin/users creates new user", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"username":         "testcreateduser",
				"email":            "testcreateduser@example.com",
				"password":         "SecurePassword123!",
				"password_confirm": "SecurePassword123!",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var userInfo UserInfo
		require.NoError(t, resp.GetJSON(&userInfo))
		assert.Equal(t, "testcreateduser", userInfo.Username)
		assert.Equal(t, "testcreateduser@example.com", userInfo.Email)
		createdUserID = userInfo.ID
	})

	t.Run("POST /api/v1/admin/users returns 400 for duplicate user", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"username":         "testcreateduser",
				"email":            "testcreateduser@example.com",
				"password":         "SecurePassword123!",
				"password_confirm": "SecurePassword123!",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/users/:id/roles returns user roles", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users/" + itoa(createdUserID) + "/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var rolesResp UserRolesResponse
		require.NoError(t, resp.GetJSON(&rolesResp))
		assert.Equal(t, "testcreateduser", rolesResp.User.Username)
		assert.NotEmpty(t, rolesResp.AllRoles)
	})

	t.Run("GET /api/v1/admin/users/:id/roles returns 404 for non-existent user", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users/99999/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})
}

func TestRBACRolesEndpointsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacroleuser",
		Email:    "rbacroleuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/roles returns roles list", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var rolesResp RolesListResponse
		require.NoError(t, resp.GetJSON(&rolesResp))
		assert.NotEmpty(t, rolesResp.Roles)

		var hasAdmin bool
		for _, role := range rolesResp.Roles {
			if role.Name == "admin" {
				hasAdmin = true
				assert.True(t, role.IsAdmin)
			}
		}
		assert.True(t, hasAdmin, "admin role should exist")
	})

	var createdRoleID uint

	t.Run("POST /api/v1/admin/roles creates new role", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"name":        "testrole",
				"description": "Test role for E2E tests",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var role RoleWithPermissions
		require.NoError(t, resp.GetJSON(&role))
		assert.Equal(t, "testrole", role.Name)
		assert.Equal(t, "Test role for E2E tests", role.Description)
		assert.False(t, role.IsAdmin)
		createdRoleID = role.ID
	})

	t.Run("PUT /api/v1/admin/roles/:id updates role", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "PUT",
			Path:   "/api/v1/admin/roles/" + itoa(createdRoleID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"name":        "testrole-updated",
				"description": "Updated description",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var role RoleWithPermissions
		require.NoError(t, resp.GetJSON(&role))
		assert.Equal(t, "testrole-updated", role.Name)
		assert.Equal(t, "Updated description", role.Description)
	})

	t.Run("DELETE /api/v1/admin/roles/:id deletes role", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/admin/roles/" + itoa(createdRoleID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestRBACAssignRevokeRoleJWT(t *testing.T) {
	app := SetupTestApp(t)

	adminUser := &e2etesting.TestUser{
		Username: "rbacassignadmin",
		Email:    "rbacassignadmin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, adminUser)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: adminUser.Username,
		Password: adminUser.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	createResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/admin/users",
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
			"Content-Type":  "application/json",
		},
		Body: map[string]interface{}{
			"username":         "assigntestuser",
			"email":            "assigntestuser@example.com",
			"password":         "SecurePassword123!",
			"password_confirm": "SecurePassword123!",
		},
	})
	require.NoError(t, err)
	require.Equal(t, 201, createResp.StatusCode)

	var createdUser UserInfo
	require.NoError(t, createResp.GetJSON(&createdUser))

	roleResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/admin/roles",
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
			"Content-Type":  "application/json",
		},
		Body: map[string]interface{}{
			"name":        "assigntestrole",
			"description": "Test role for assignment",
		},
	})
	require.NoError(t, err)
	require.Equal(t, 201, roleResp.StatusCode)

	var createdRole RoleWithPermissions
	require.NoError(t, roleResp.GetJSON(&createdRole))

	t.Run("POST /api/v1/admin/users/assign-role assigns role to user", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/users/assign-role",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"user_id": createdUser.ID,
				"role_id": createdRole.ID,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/users/revoke-role revokes role from user", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/users/revoke-role",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"user_id": createdUser.ID,
				"role_id": createdRole.ID,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestRBACStackPermissionsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacstackpermuser",
		Email:    "rbacstackpermuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	roleResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/admin/roles",
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
			"Content-Type":  "application/json",
		},
		Body: map[string]interface{}{
			"name":        "stackpermtestrole",
			"description": "Role for stack permission tests",
		},
	})
	require.NoError(t, err)
	require.Equal(t, 201, roleResp.StatusCode)

	var createdRole RoleWithPermissions
	require.NoError(t, roleResp.GetJSON(&createdRole))

	t.Run("GET /api/v1/admin/roles/:roleId/stack-permissions returns stack permissions", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stackPermResp StackPermissionsResponse
		require.NoError(t, resp.GetJSON(&stackPermResp))
		assert.NotNil(t, stackPermResp.Role)
		assert.NotNil(t, stackPermResp.Permissions)
	})

	t.Run("GET /api/v1/admin/roles/:roleId/stack-permissions returns 400 for admin role", func(t *testing.T) {

		rolesResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		var roles RolesListResponse
		require.NoError(t, rolesResp.GetJSON(&roles))

		var adminRoleID uint
		for _, role := range roles.Roles {
			if role.IsAdmin {
				adminRoleID = role.ID
				break
			}
		}
		require.NotZero(t, adminRoleID, "admin role should exist")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(adminRoleID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "rbac-stackperm-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	permResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "GET",
		Path:   "/api/v1/admin/permissions",
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 200, permResp.StatusCode)

	var permList struct {
		Permissions []struct {
			ID   uint   `json:"id"`
			Name string `json:"name"`
		} `json:"permissions"`
	}
	require.NoError(t, permResp.GetJSON(&permList))
	require.NotEmpty(t, permList.Permissions, "should have permissions")
	testPermissionID := permList.Permissions[0].ID

	var createdStackPermissionID uint

	t.Run("POST /api/v1/admin/roles/:roleId/stack-permissions creates stack permission", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"server_id":     testServer.ID,
				"permission_id": testPermissionID,
				"stack_pattern": "test-*",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		getResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, getResp.StatusCode)

		var stackPermResp StackPermissionsResponse
		require.NoError(t, getResp.GetJSON(&stackPermResp))
		require.NotEmpty(t, stackPermResp.PermissionRules, "should have permission rules")

		idVal, ok := stackPermResp.PermissionRules[0]["id"].(float64)
		require.True(t, ok, "id should be a number")
		createdStackPermissionID = uint(idVal)
	})

	t.Run("POST /api/v1/admin/roles/:roleId/stack-permissions requires server_id and permission_id", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"stack_pattern": "test-*",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/v1/admin/roles/:roleId/stack-permissions rejects duplicate", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"server_id":     testServer.ID,
				"permission_id": testPermissionID,
				"stack_pattern": "test-*",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/admin/roles/:roleId/stack-permissions/:permissionId deletes permission", func(t *testing.T) {
		require.NotZero(t, createdStackPermissionID, "stack permission must be created first")

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions/" + itoa(createdStackPermissionID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, getResp.StatusCode)

		var stackPermResp StackPermissionsResponse
		require.NoError(t, getResp.GetJSON(&stackPermResp))
		assert.Empty(t, stackPermResp.PermissionRules)
	})
}

func TestRBACPermissionsEndpointJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacpermlistuser",
		Email:    "rbacpermlistuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/permissions returns all permissions", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permResp PermissionsListResponse
		require.NoError(t, resp.GetJSON(&permResp))
		assert.NotEmpty(t, permResp.Permissions)
	})

	t.Run("GET /api/v1/admin/permissions?type=role filters permissions", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/permissions?type=role",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permResp PermissionsListResponse
		require.NoError(t, resp.GetJSON(&permResp))

		for _, perm := range permResp.Permissions {
			assert.False(t, perm.IsAPIKeyOnly, "role type filter should exclude API-key-only permissions")
		}
	})
}

func TestRBACEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/admin/users requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/users")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/roles requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/roles")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/permissions requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/admin/permissions")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestRBACEndpointsNonAdmin(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacregularuser",
		Email:    "rbacregularuser@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", LoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login LoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.AccessToken

	t.Run("GET /api/v1/admin/users returns 403 for non-admin", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/roles returns 403 for non-admin", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 403, resp.StatusCode)
	})
}
