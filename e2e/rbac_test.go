package e2e

import (
	"berth/internal/dto"
	"berth/internal/rbac"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type (
	UserInfo            = dto.UserInfo
	RoleInfo            = dto.RoleInfo
	RoleWithPermissions = dto.RoleWithPermissions
	PermissionInfo      = dto.PermissionInfo
	CreateUserResponse  = rbac.CreateUserResponse
	AssignRoleResponse  = rbac.AssignRoleResponse
	RevokeRoleResponse  = rbac.RevokeRoleResponse

	CreateRoleResponse               = rbac.CreateRoleResponse
	UpdateRoleResponse               = rbac.UpdateRoleResponse
	DeleteRoleResponse               = rbac.DeleteRoleResponse
	ListRoleStackPermissionsResponse = rbac.ListRoleStackPermissionsResponse
	CreateStackPermissionResponse    = rbac.CreateStackPermissionResponse
	DeleteStackPermissionResponse    = rbac.DeleteStackPermissionResponse
	ListRolesResponse                = rbac.ListRolesResponse
	ListUsersResponse                = rbac.ListUsersResponse
	GetUserRolesResponse             = rbac.GetUserRolesResponse
)

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
		TagTest(t, "GET", "/api/v1/admin/users", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var usersResp ListUsersResponse
		require.NoError(t, resp.GetJSON(&usersResp))
		assert.NotEmpty(t, usersResp.Data.Users)
	})

	var createdUserID uint

	t.Run("POST /api/v1/admin/users creates new user", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/users", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var createResp CreateUserResponse
		require.NoError(t, resp.GetJSON(&createResp))
		assert.True(t, createResp.Success)
		assert.Equal(t, "testcreateduser", createResp.Data.Username)
		assert.Equal(t, "testcreateduser@example.com", createResp.Data.Email)
		createdUserID = createResp.Data.ID
	})

	t.Run("POST /api/v1/admin/users returns 400 for duplicate user", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/users", e2etesting.CategoryValidation, e2etesting.ValueMedium)
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
		TagTest(t, "GET", "/api/v1/admin/users/:id/roles", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/users/" + itoa(createdUserID) + "/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var rolesResp GetUserRolesResponse
		require.NoError(t, resp.GetJSON(&rolesResp))
		assert.Equal(t, "testcreateduser", rolesResp.Data.User.Username)
		assert.NotEmpty(t, rolesResp.Data.AllRoles)
	})

	t.Run("GET /api/v1/admin/users/:id/roles returns 404 for non-existent user", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/users/:id/roles", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
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
		TagTest(t, "GET", "/api/v1/admin/roles", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var rolesResp ListRolesResponse
		require.NoError(t, resp.GetJSON(&rolesResp))
		assert.NotEmpty(t, rolesResp.Data.Roles)

		var hasAdmin bool
		for _, role := range rolesResp.Data.Roles {
			if role.Name == "admin" {
				hasAdmin = true
				assert.True(t, role.IsAdmin)
			}
		}
		assert.True(t, hasAdmin, "admin role should exist")
	})

	var createdRoleID uint

	t.Run("POST /api/v1/admin/roles creates new role", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var createResp CreateRoleResponse
		require.NoError(t, resp.GetJSON(&createResp))
		assert.True(t, createResp.Success)
		assert.Equal(t, "testrole", createResp.Data.Name)
		assert.Equal(t, "Test role for E2E tests", createResp.Data.Description)
		assert.False(t, createResp.Data.IsAdmin)
		createdRoleID = createResp.Data.ID
	})

	t.Run("PUT /api/v1/admin/roles/:id updates role", func(t *testing.T) {
		TagTest(t, "PUT", "/api/v1/admin/roles/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var updateResp UpdateRoleResponse
		require.NoError(t, resp.GetJSON(&updateResp))
		assert.True(t, updateResp.Success)
		assert.Equal(t, "testrole-updated", updateResp.Data.Name)
		assert.Equal(t, "Updated description", updateResp.Data.Description)
	})

	t.Run("DELETE /api/v1/admin/roles/:id deletes role", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/admin/roles/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/admin/roles/" + itoa(createdRoleID),
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var deleteResp DeleteRoleResponse
		require.NoError(t, resp.GetJSON(&deleteResp))
		assert.True(t, deleteResp.Success)
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

	var createUserResp CreateUserResponse
	require.NoError(t, createResp.GetJSON(&createUserResp))
	createdUser := createUserResp.Data

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

	var createRoleResp CreateRoleResponse
	require.NoError(t, roleResp.GetJSON(&createRoleResp))
	createdRole := createRoleResp.Data

	t.Run("POST /api/v1/admin/users/assign-role assigns role to user", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/users/assign-role", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var assignResp AssignRoleResponse
		require.NoError(t, resp.GetJSON(&assignResp))
		assert.True(t, assignResp.Success)
	})

	t.Run("POST /api/v1/admin/users/revoke-role revokes role from user", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/users/revoke-role", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var revokeResp RevokeRoleResponse
		require.NoError(t, resp.GetJSON(&revokeResp))
		assert.True(t, revokeResp.Success)
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

	var createRoleResp CreateRoleResponse
	require.NoError(t, roleResp.GetJSON(&createRoleResp))
	createdRole := createRoleResp.Data

	t.Run("GET /api/v1/admin/roles/:roleId/stack-permissions returns stack permissions", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/roles/:roleId/stack-permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var stackPermResp ListRoleStackPermissionsResponse
		require.NoError(t, resp.GetJSON(&stackPermResp))
		assert.True(t, stackPermResp.Success)
		assert.NotEmpty(t, stackPermResp.Data.Role.Name)
		assert.NotNil(t, stackPermResp.Data.Permissions)
	})

	t.Run("GET /api/v1/admin/roles/:roleId/stack-permissions returns 400 for admin role", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/roles/:roleId/stack-permissions", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		rolesResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)

		var roles ListRolesResponse
		require.NoError(t, rolesResp.GetJSON(&roles))

		var adminRoleID uint
		for _, role := range roles.Data.Roles {
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
		TagTest(t, "POST", "/api/v1/admin/roles/:roleId/stack-permissions", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var createResp CreateStackPermissionResponse
		require.NoError(t, resp.GetJSON(&createResp))
		assert.True(t, createResp.Success)

		getResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, getResp.StatusCode)

		var stackPermResp ListRoleStackPermissionsResponse
		require.NoError(t, getResp.GetJSON(&stackPermResp))
		require.NotEmpty(t, stackPermResp.Data.PermissionRules, "should have permission rules")

		createdStackPermissionID = stackPermResp.Data.PermissionRules[0].ID
	})

	t.Run("POST /api/v1/admin/roles/:roleId/stack-permissions requires server_id and permission_id", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/admin/roles/:roleId/stack-permissions", e2etesting.CategoryValidation, e2etesting.ValueMedium)
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
		TagTest(t, "POST", "/api/v1/admin/roles/:roleId/stack-permissions", e2etesting.CategoryValidation, e2etesting.ValueMedium)
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
		TagTest(t, "DELETE", "/api/v1/admin/roles/:roleId/stack-permissions/:permissionId", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
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

		var deleteResp DeleteStackPermissionResponse
		require.NoError(t, resp.GetJSON(&deleteResp))
		assert.True(t, deleteResp.Success)

		getResp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles/" + itoa(createdRole.ID) + "/stack-permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 200, getResp.StatusCode)

		var stackPermResp ListRoleStackPermissionsResponse
		require.NoError(t, getResp.GetJSON(&stackPermResp))
		assert.Empty(t, stackPermResp.Data.PermissionRules)
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
		TagTest(t, "GET", "/api/v1/admin/permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
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
		TagTest(t, "GET", "/api/v1/admin/permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
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
		TagTest(t, "GET", "/api/v1/admin/users", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/admin/users")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/roles requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/roles", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/admin/roles")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/admin/permissions requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/admin/permissions", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
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
		TagTest(t, "GET", "/api/v1/admin/users", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
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
		TagTest(t, "GET", "/api/v1/admin/roles", e2etesting.CategoryAuthorization, e2etesting.ValueMedium)
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
