package e2e

import (
	"flag"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	e2etesting "berth/e2e/internal/harness"
	"berth/handlers"

	"github.com/stretchr/testify/require"
)

var updateSnapshots = flag.Bool("update", false, "update golden snapshot files")

func snapshotDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "testdata", "snapshots")
}
func jwtLogin(t *testing.T, app *TestApp, username, email, password string, admin bool) string {
	t.Helper()
	user := &e2etesting.TestUser{
		Username: username,
		Email:    email,
		Password: password,
	}
	if admin {
		app.CreateAdminTestUser(t, user)
	} else {
		app.AuthHelper.CreateTestUser(t, user)
	}
	resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: username, Password: password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)
	var login handlers.AuthLoginResponse
	require.NoError(t, resp.GetJSON(&login))
	return login.Data.AccessToken
}
func jwtRequest(t *testing.T, app *TestApp, token, method, path string) *e2etesting.Response {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  method,
		Path:    path,
		Headers: map[string]string{"Authorization": "Bearer " + token},
	})
	require.NoError(t, err)
	return resp
}
func jwtRequestJSON(t *testing.T, app *TestApp, token, method, path string, body interface{}) *e2etesting.Response {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  method,
		Path:    path,
		Body:    body,
		Headers: map[string]string{"Authorization": "Bearer " + token},
	})
	require.NoError(t, err)
	return resp
}
func sessionLogin(t *testing.T, app *TestApp, username, email, password string, admin bool) *e2etesting.HTTPClient {
	t.Helper()
	user := &e2etesting.TestUser{
		Username: username,
		Email:    email,
		Password: password,
	}
	if admin {
		app.CreateAdminTestUser(t, user)
	} else {
		app.AuthHelper.CreateTestUser(t, user)
		err := app.DB.Table("users").Where("email = ?", email).Update("email_verified_at", "2026-01-01").Error
		require.NoError(t, err)
	}
	return app.SessionHelper.SimulateLogin(t, app.AuthHelper, username, password)
}

func TestSnapshotUnauthenticatedWeb(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)
	client := app.HTTPClient.WithCookieJar()

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/auth/login"},
		{"GET", "/auth/register"},
		{"GET", "/auth/password-reset"},
		{"GET", "/auth/password-reset/confirm"},
		{"GET", "/auth/verify-email"},
		{"GET", "/auth/totp/verify"},
		{"GET", "/auth/totp/setup"},
		{"GET", "/setup/admin"},
	}

	for _, r := range routes {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			resp, err := client.Request(&e2etesting.RequestOptions{
				Method: r.method,
				Path:   r.path,
			})
			require.NoError(t, err)
			sr.RecordAndAssert(t, r.method, r.path, resp)
		})
	}
}

func TestSnapshotAuthenticatedWeb(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	user := app.CreateVerifiedTestUser(t)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/"},
		{"GET", "/profile"},
		{"GET", "/sessions"},
		{"GET", "/stacks"},
		{"GET", "/operation-logs"},
		{"GET", "/api-keys"},
	}

	for _, r := range routes {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			resp, err := client.Request(&e2etesting.RequestOptions{
				Method: r.method,
				Path:   r.path,
			})
			require.NoError(t, err)
			sr.RecordAndAssert(t, r.method, r.path, resp)
		})
	}
}

func TestSnapshotAuthenticatedWebParams(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	user := &e2etesting.TestUser{
		Username: "snapwebparam",
		Email:    "snapwebparam@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "snap-web-server")
	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{
		{"name": "snap-stack", "path": "/opt/snap-stack", "compose_file": "docker-compose.yml",
			"is_healthy": true, "total_containers": 1, "running_containers": 1},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack", map[string]interface{}{
		"name": "snap-stack", "path": "/opt/snap-stack", "compose_file": "docker-compose.yml",
		"services": []map[string]interface{}{
			{"name": "web", "image": "nginx:latest", "containers": []map[string]interface{}{
				{"name": "snap-stack-web-1", "state": "running"},
			}},
		},
	})
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/system/info", map[string]interface{}{
		"docker_version": "24.0.0", "os": "linux",
	})
	mockAgent.RegisterJSONHandler("/api/registries", []interface{}{})

	serverID := testServer.ID

	paramRoutes := []struct {
		method string
		path   string
		snap   string
	}{
		{"GET", fmt.Sprintf("/servers/%d/stacks", serverID), "/servers/:id/stacks"},
		{"GET", fmt.Sprintf("/servers/%d/stacks/snap-stack", serverID), "/servers/:serverid/stacks/:stackname"},
		{"GET", fmt.Sprintf("/servers/%d/maintenance", serverID), "/servers/:serverid/maintenance"},
		{"GET", fmt.Sprintf("/servers/%d/registries", serverID), "/servers/:serverid/registries"},
	}

	for _, r := range paramRoutes {
		t.Run(r.method+" "+r.snap, func(t *testing.T) {
			resp, err := client.Request(&e2etesting.RequestOptions{
				Method: r.method,
				Path:   r.path,
			})
			require.NoError(t, err)
			sr.RecordAndAssert(t, r.method, r.snap, resp)
		})
	}
}

func TestSnapshotAdminWeb(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	adminUser := &e2etesting.TestUser{
		Username: "snapshotadmin",
		Email:    "snapshotadmin@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, adminUser)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, adminUser.Username, adminUser.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "snap-admin-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	var adminRoleID uint
	err := app.DB.Table("roles").Where("name = ?", "admin").Pluck("id", &adminRoleID).Error
	require.NoError(t, err)

	routes := []struct {
		method string
		path   string
		snap   string
	}{
		{"GET", "/admin/servers", "/admin/servers"},
		{"GET", "/admin/roles", "/admin/roles"},
		{"GET", "/admin/users", "/admin/users"},
		{"GET", "/admin/agent-update", "/admin/agent-update"},
		{"GET", "/admin/migration", "/admin/migration"},
		{"GET", "/admin/operation-logs", "/admin/operation-logs"},
		{"GET", "/admin/security-audit-logs", "/admin/security-audit-logs"},
		{"GET", fmt.Sprintf("/admin/servers/%d", testServer.ID), "/admin/servers/:id"},
		{"GET", fmt.Sprintf("/admin/roles/%d/stack-permissions", adminRoleID), "/admin/roles/:id/stack-permissions"},
		{"GET", fmt.Sprintf("/admin/users/%d/roles", adminUser.ID), "/admin/users/:id/roles"},
	}

	for _, r := range routes {
		t.Run(r.method+" "+r.snap, func(t *testing.T) {
			resp, err := client.Request(&e2etesting.RequestOptions{
				Method: r.method,
				Path:   r.path,
			})
			require.NoError(t, err)
			sr.RecordAndAssert(t, r.method, r.snap, resp)
		})
	}
}

func TestSnapshotWebAuthForms(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	t.Run("POST /auth/login failed", func(t *testing.T) {
		resp, err := app.AuthHelper.Login("nonexistent", "badpassword")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/login_failed", resp)
	})

	t.Run("POST /auth/login success", func(t *testing.T) {
		user := app.CreateVerifiedTestUser(t)
		resp, err := app.AuthHelper.Login(user.Username, user.Password)
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/login_success", resp)
	})

	t.Run("POST /auth/register", func(t *testing.T) {
		resp, err := app.AuthHelper.Register("snapreguser", "snapreg@example.com", "password123")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/register", resp)
	})

	t.Run("POST /auth/logout", func(t *testing.T) {
		user := &e2etesting.TestUser{
			Username: "snaplogout",
			Email:    "snaplogout@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)
		client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
		resp, err := client.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/auth/logout",
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/logout", resp)
	})

	t.Run("POST /auth/password-reset", func(t *testing.T) {
		resp, err := app.AuthHelper.RequestPasswordReset("nonexistent@example.com")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/password-reset", resp)
	})

	t.Run("POST /auth/password-reset/confirm", func(t *testing.T) {
		resp, err := app.AuthHelper.ResetPassword("invalid-token", "newpassword123")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/password-reset/confirm", resp)
	})

	t.Run("POST /auth/resend-verification", func(t *testing.T) {
		resp, err := app.AuthHelper.ResendVerification("nonexistent@example.com")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/resend-verification", resp)
	})

	t.Run("POST /auth/verify-email", func(t *testing.T) {
		resp, err := app.AuthHelper.VerifyEmail("invalid-token")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/verify-email", resp)
	})

	t.Run("POST /auth/totp/verify", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, _ = client.Get("/auth/login")
		resp, err := client.PostForm("/auth/totp/verify", nil)
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/auth/totp/verify", resp)
	})

	t.Run("POST /setup/admin", func(t *testing.T) {
		client := app.HTTPClient.WithCookieJar().WithoutRedirects()
		_, _ = client.Get("/setup/admin")
		resp, err := client.PostForm("/setup/admin", nil)
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/setup/admin", resp)
	})
}

func TestSnapshotUnauthenticatedAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	t.Run("POST /api/v1/auth/login bad_creds", func(t *testing.T) {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: "nonexistent",
			Password: "badpassword",
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/api/v1/auth/login_error", resp)
	})

	unauthRoutes := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/profile"},
		{"GET", "/api/v1/servers"},
		{"GET", "/api/v1/totp/status"},
		{"GET", "/api/v1/api-keys"},
		{"GET", "/api/v1/operation-logs"},
		{"GET", "/api/v1/running-operations"},
		{"GET", "/api/v1/image-updates"},
		{"GET", "/api/v1/admin/roles"},
		{"GET", "/api/v1/admin/users"},
	}

	for _, r := range unauthRoutes {
		t.Run(r.method+" "+r.path+" unauth", func(t *testing.T) {
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method: r.method,
				Path:   r.path,
			})
			require.NoError(t, err)
			sr.RecordAndAssert(t, r.method, r.path+"_unauth", resp)
		})
	}
}

func TestSnapshotAPIAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	user := &e2etesting.TestUser{
		Username: "snapauthapi",
		Email:    "snapauthapi@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("POST /api/v1/auth/login", func(t *testing.T) {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: user.Username, Password: user.Password,
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/api/v1/auth/login", resp)
	})

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username, Password: user.Password,
	})
	require.NoError(t, err)
	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	accessToken := login.Data.AccessToken
	refreshToken := login.Data.RefreshToken

	t.Run("POST /api/v1/auth/refresh", func(t *testing.T) {
		resp, err := app.HTTPClient.Post("/api/v1/auth/refresh", handlers.AuthRefreshRequest{
			RefreshToken: refreshToken,
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "POST", "/api/v1/auth/refresh", resp)
	})

	t.Run("POST /api/v1/auth/totp/verify", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, accessToken, "POST", "/api/v1/auth/totp/verify", map[string]string{
			"code": "123456",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/auth/totp/verify", resp)
	})

	t.Run("POST /api/v1/auth/logout", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, accessToken, "POST", "/api/v1/auth/logout", handlers.AuthLogoutRequest{
			RefreshToken: refreshToken,
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/auth/logout", resp)
	})
}

func TestSnapshotAuthenticatedAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	token := jwtLogin(t, app, "snapapiuser", "snapapiuser@example.com", "password123", true)

	getRoutes := []struct {
		path string
	}{
		{"/api/v1/profile"},
		{"/api/v1/servers"},
		{"/api/v1/totp/status"},
		{"/api/v1/totp/setup"},
		{"/api/v1/api-keys"},
		{"/api/v1/operation-logs"},
		{"/api/v1/operation-logs/stats"},
		{"/api/v1/running-operations"},
		{"/api/v1/image-updates"},
		{"/api/v1/version"},
	}

	for _, r := range getRoutes {
		t.Run("GET "+r.path, func(t *testing.T) {
			resp := jwtRequest(t, app, token, "GET", r.path)
			sr.RecordAndAssert(t, "GET", r.path, resp)
		})
	}

	t.Run("POST /api/v1/totp/enable", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/totp/enable", map[string]string{
			"code": "",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/totp/enable", resp)
	})

	t.Run("POST /api/v1/totp/disable", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/totp/disable", map[string]string{
			"code": "123456", "password": "password123",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/totp/disable", resp)
	})

	t.Run("POST /api/v1/sessions", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/sessions", nil)
		sr.RecordAndAssert(t, "POST", "/api/v1/sessions", resp)
	})

	t.Run("POST /api/v1/sessions/revoke-all-others", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/sessions/revoke-all-others", nil)
		sr.RecordAndAssert(t, "POST", "/api/v1/sessions/revoke-all-others", resp)
	})

	t.Run("POST /api/v1/sessions/revoke", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/sessions/revoke", map[string]string{
			"token": "nonexistent-session-token",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/sessions/revoke", resp)
	})

	t.Run("POST /api/v1/api-keys", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, token, "POST", "/api/v1/api-keys", map[string]string{
			"name": "Snapshot Test Key",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/api-keys", resp)

		var result struct {
			Success bool `json:"success"`
			Data    struct {
				APIKey struct {
					ID uint `json:"id"`
				} `json:"api_key"`
			} `json:"data"`
		}
		require.NoError(t, resp.GetJSON(&result))
		keyID := result.Data.APIKey.ID

		t.Run("GET /api/v1/api-keys/:id", func(t *testing.T) {
			resp := jwtRequest(t, app, token, "GET", fmt.Sprintf("/api/v1/api-keys/%d", keyID))
			sr.RecordAndAssert(t, "GET", "/api/v1/api-keys/:id", resp)
		})

		t.Run("GET /api/v1/api-keys/:id/scopes", func(t *testing.T) {
			resp := jwtRequest(t, app, token, "GET", fmt.Sprintf("/api/v1/api-keys/%d/scopes", keyID))
			sr.RecordAndAssert(t, "GET", "/api/v1/api-keys/:id/scopes", resp)
		})

		t.Run("POST /api/v1/api-keys/:id/scopes", func(t *testing.T) {
			mockAgent, testSrv := app.CreateTestServerWithAgent(t, "snap-scope-server")
			mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

			resp := jwtRequestJSON(t, app, token, "POST", fmt.Sprintf("/api/v1/api-keys/%d/scopes", keyID), map[string]interface{}{
				"server_id":     testSrv.ID,
				"stack_pattern": "*",
				"permission":    "stacks.read",
			})
			sr.RecordAndAssert(t, "POST", "/api/v1/api-keys/:id/scopes", resp)

			listResp := jwtRequest(t, app, token, "GET", fmt.Sprintf("/api/v1/api-keys/%d/scopes", keyID))
			var listResult struct {
				Data []struct {
					ID uint `json:"id"`
				} `json:"data"`
			}
			if listResp.GetJSON(&listResult) == nil && len(listResult.Data) > 0 {
				scopeID := listResult.Data[0].ID
				t.Run("DELETE /api/v1/api-keys/:id/scopes/:scopeId", func(t *testing.T) {
					resp := jwtRequest(t, app, token, "DELETE", fmt.Sprintf("/api/v1/api-keys/%d/scopes/%d", keyID, scopeID))
					sr.RecordAndAssert(t, "DELETE", "/api/v1/api-keys/:id/scopes/:scopeId", resp)
				})
			}
		})

		t.Run("DELETE /api/v1/api-keys/:id", func(t *testing.T) {
			resp := jwtRequest(t, app, token, "DELETE", fmt.Sprintf("/api/v1/api-keys/%d", keyID))
			sr.RecordAndAssert(t, "DELETE", "/api/v1/api-keys/:id", resp)
		})
	})

	t.Run("GET /api-keys/:id/scopes web", func(t *testing.T) {
		client := sessionLogin(t, app, "snapapikeyweb", "snapapikeyweb@example.com", "password123", false)
		createResp, err := client.Post("/api/v1/api-keys", map[string]string{"name": "web-snap-key"})
		require.NoError(t, err)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				APIKey struct {
					ID uint `json:"id"`
				} `json:"api_key"`
			} `json:"data"`
		}
		require.NoError(t, createResp.GetJSON(&result))
		resp, err := client.Get(fmt.Sprintf("/api-keys/%d/scopes", result.Data.APIKey.ID))
		require.NoError(t, err)
		sr.RecordAndAssert(t, "GET", "/api-keys/:id/scopes", resp)
	})
}

func TestSnapshotAdminAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	adminToken := jwtLogin(t, app, "snapadminapi", "snapadminapi@example.com", "password123", true)
	normalToken := jwtLogin(t, app, "snapnormalapi", "snapnormalapi@example.com", "password123", false)

	adminGetRoutes := []string{
		"/api/v1/admin/roles",
		"/api/v1/admin/users",
		"/api/v1/admin/permissions",
		"/api/v1/admin/security-audit-logs",
		"/api/v1/admin/security-audit-logs/stats",
		"/api/v1/admin/operation-logs",
		"/api/v1/admin/operation-logs/stats",
	}

	for _, path := range adminGetRoutes {
		t.Run("GET "+path, func(t *testing.T) {
			resp := jwtRequest(t, app, adminToken, "GET", path)
			sr.RecordAndAssert(t, "GET", path, resp)
		})
	}

	t.Run("GET /api/v1/admin/roles forbidden", func(t *testing.T) {
		resp := jwtRequest(t, app, normalToken, "GET", "/api/v1/admin/roles")
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/roles_forbidden", resp)
	})

	var adminRoleID uint
	err := app.DB.Table("roles").Where("name = ?", "admin").Pluck("id", &adminRoleID).Error
	require.NoError(t, err)

	var normalUserID uint
	err = app.DB.Table("users").Where("username = ?", "snapnormalapi").Pluck("id", &normalUserID).Error
	require.NoError(t, err)

	t.Run("GET /api/v1/admin/roles/:roleId/stack-permissions", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", fmt.Sprintf("/api/v1/admin/roles/%d/stack-permissions", adminRoleID))
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/roles/:roleId/stack-permissions", resp)
	})

	t.Run("GET /api/v1/admin/users/:id/roles", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", fmt.Sprintf("/api/v1/admin/users/%d/roles", normalUserID))
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/users/:id/roles", resp)
	})

	t.Run("POST /api/v1/admin/roles", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/roles", map[string]interface{}{
			"name":        "snapshot-test-role",
			"permissions": []string{},
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/roles", resp)

		var result struct {
			Success bool `json:"success"`
			Data    struct {
				ID uint `json:"id"`
			} `json:"data"`
		}
		if resp.GetJSON(&result) == nil && result.Data.ID > 0 {
			roleID := result.Data.ID

			t.Run("PUT /api/v1/admin/roles/:id", func(t *testing.T) {
				resp := jwtRequestJSON(t, app, adminToken, "PUT", fmt.Sprintf("/api/v1/admin/roles/%d", roleID), map[string]interface{}{
					"name":        "snapshot-test-role-updated",
					"permissions": []string{},
				})
				sr.RecordAndAssert(t, "PUT", "/api/v1/admin/roles/:id", resp)
			})

			t.Run("DELETE /api/v1/admin/roles/:id", func(t *testing.T) {
				resp := jwtRequest(t, app, adminToken, "DELETE", fmt.Sprintf("/api/v1/admin/roles/%d", roleID))
				sr.RecordAndAssert(t, "DELETE", "/api/v1/admin/roles/:id", resp)
			})
		}
	})

	t.Run("POST /api/v1/admin/roles/:roleId/stack-permissions", func(t *testing.T) {
		roleResp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/roles", map[string]interface{}{
			"name":        "snap-stack-perm-role",
			"permissions": []string{},
		})
		require.Equal(t, 201, roleResp.StatusCode)
		var roleResult struct {
			Data struct {
				ID uint `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, roleResp.GetJSON(&roleResult))
		testRoleID := roleResult.Data.ID

		mockAgent, testServer := app.CreateTestServerWithAgent(t, "snap-admin-stack-perm")
		mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

		var permID uint
		err := app.DB.Table("permissions").Where("name = ?", "stacks.read").Pluck("id", &permID).Error
		require.NoError(t, err)

		resp := jwtRequestJSON(t, app, adminToken, "POST", fmt.Sprintf("/api/v1/admin/roles/%d/stack-permissions", testRoleID), map[string]interface{}{
			"server_id":     testServer.ID,
			"permission_id": permID,
			"stack_pattern": "*",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/roles/:roleId/stack-permissions", resp)

		listResp := jwtRequest(t, app, adminToken, "GET", fmt.Sprintf("/api/v1/admin/roles/%d/stack-permissions", testRoleID))
		var listResult struct {
			Data struct {
				PermissionRules []struct {
					ID uint `json:"id"`
				} `json:"permissionRules"`
			} `json:"data"`
		}
		if listResp.GetJSON(&listResult) == nil && len(listResult.Data.PermissionRules) > 0 {
			stackPermID := listResult.Data.PermissionRules[0].ID
			t.Run("DELETE /api/v1/admin/roles/:roleId/stack-permissions/:permissionId", func(t *testing.T) {
				resp := jwtRequest(t, app, adminToken, "DELETE", fmt.Sprintf("/api/v1/admin/roles/%d/stack-permissions/%d", testRoleID, stackPermID))
				sr.RecordAndAssert(t, "DELETE", "/api/v1/admin/roles/:roleId/stack-permissions/:permissionId", resp)
			})
		}
	})

	t.Run("POST /api/v1/admin/users", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/users", map[string]interface{}{
			"username": "snap-created-user",
			"email":    "snap-created@example.com",
			"password": "password123",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/users", resp)
	})

	t.Run("POST /api/v1/admin/users/assign-role", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/users/assign-role", map[string]interface{}{
			"user_id": normalUserID,
			"role_id": adminRoleID,
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/users/assign-role", resp)
	})

	t.Run("POST /api/v1/admin/users/revoke-role", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/users/revoke-role", map[string]interface{}{
			"user_id": normalUserID,
			"role_id": adminRoleID,
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/users/revoke-role", resp)
	})

	t.Run("admin server CRUD", func(t *testing.T) {
		mockAgent2, _ := app.CreateTestServerWithAgent(t, "snap-admin-server-crud")
		mockAgent2.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

		t.Run("GET /api/v1/admin/servers", func(t *testing.T) {
			resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/admin/servers")
			sr.RecordAndAssert(t, "GET", "/api/v1/admin/servers", resp)
		})

		var serverID uint
		err := app.DB.Table("servers").Where("name = ?", "snap-admin-server-crud").Pluck("id", &serverID).Error
		require.NoError(t, err)

		t.Run("GET /api/v1/admin/servers/:id", func(t *testing.T) {
			resp := jwtRequest(t, app, adminToken, "GET", fmt.Sprintf("/api/v1/admin/servers/%d", serverID))
			sr.RecordAndAssert(t, "GET", "/api/v1/admin/servers/:id", resp)
		})

		t.Run("PUT /api/v1/admin/servers/:id", func(t *testing.T) {
			resp := jwtRequestJSON(t, app, adminToken, "PUT", fmt.Sprintf("/api/v1/admin/servers/%d", serverID), map[string]interface{}{
				"name": "snap-admin-server-updated",
			})
			sr.RecordAndAssert(t, "PUT", "/api/v1/admin/servers/:id", resp)
		})

		t.Run("POST /api/v1/admin/servers/:id/test", func(t *testing.T) {
			resp := jwtRequestJSON(t, app, adminToken, "POST", fmt.Sprintf("/api/v1/admin/servers/%d/test", serverID), nil)
			sr.RecordAndAssert(t, "POST", "/api/v1/admin/servers/:id/test", resp)
		})

		t.Run("DELETE /api/v1/admin/servers/:id", func(t *testing.T) {
			resp := jwtRequest(t, app, adminToken, "DELETE", fmt.Sprintf("/api/v1/admin/servers/%d", serverID))
			sr.RecordAndAssert(t, "DELETE", "/api/v1/admin/servers/:id", resp)
		})
	})

	t.Run("POST /api/v1/admin/servers", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/servers", map[string]interface{}{
			"name":         "snap-api-created-server",
			"host":         "10.0.0.99",
			"port":         443,
			"access_token": "test-token-value",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/servers", resp)
	})

	t.Run("GET /api/v1/admin/security-audit-logs/:id", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/admin/security-audit-logs/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/security-audit-logs/:id", resp)
	})

	t.Run("GET /api/v1/admin/operation-logs/:id", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/admin/operation-logs/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/operation-logs/:id", resp)
	})

	t.Run("GET /api/v1/operation-logs/:id", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/operation-logs/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/operation-logs/:id", resp)
	})

	t.Run("GET /api/v1/operation-logs/by-operation-id/:operationId", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/operation-logs/by-operation-id/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/operation-logs/by-operation-id/:operationId", resp)
	})

	t.Run("POST /api/v1/admin/migration/export", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/migration/export", nil)
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/migration/export", resp)
	})

	t.Run("POST /api/v1/admin/migration/import", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/admin/migration/import", map[string]interface{}{})
		sr.RecordAndAssert(t, "POST", "/api/v1/admin/migration/import", resp)
	})
}

func TestSnapshotServerAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	adminToken := jwtLogin(t, app, "snapserverapi", "snapserverapi@example.com", "password123", true)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "snap-server-api")
	serverID := testServer.ID

	mockAgent.RegisterJSONHandler("/api/stacks", []map[string]interface{}{
		{"name": "snap-stack", "path": "/opt/snap-stack", "compose_file": "docker-compose.yml",
			"is_healthy": true, "total_containers": 1, "running_containers": 1},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack", map[string]interface{}{
		"name": "snap-stack", "path": "/opt/snap-stack", "compose_file": "docker-compose.yml",
		"services": []map[string]interface{}{
			{"name": "web", "image": "nginx:latest", "containers": []map[string]interface{}{
				{"name": "snap-stack-web-1", "state": "running"},
			}},
		},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/compose", map[string]interface{}{
		"content": "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/networks", []map[string]interface{}{
		{"name": "snap-stack_default", "driver": "bridge", "exists": true},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/volumes", []map[string]interface{}{
		{"name": "snap-stack_data", "driver": "local", "exists": true},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/environment", map[string]interface{}{
		"web": []map[string]interface{}{
			{"service_name": "web", "variables": []map[string]interface{}{
				{"key": "NODE_ENV", "value": "production"},
			}},
		},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/images", []map[string]interface{}{
		{"container_name": "snap-stack-web-1", "image_id": "sha256:abc123", "image_name": "nginx:latest"},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/stats", map[string]interface{}{
		"stack_name": "snap-stack",
		"containers": []map[string]interface{}{
			{"name": "snap-stack-web-1", "cpu_percent": 2.5, "memory_usage": 52428800},
		},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/logs", map[string]interface{}{
		"logs": "fake log output",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/containers/snap-stack-web-1/logs", map[string]interface{}{
		"logs": "container log output",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/files", map[string]interface{}{
		"files": []map[string]interface{}{
			{"name": "docker-compose.yml", "size": 256, "is_dir": false},
		},
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/files/read", map[string]interface{}{
		"content": "version: '3'\n",
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/files/stats", map[string]interface{}{
		"total_size": 1024, "file_count": 3,
	})
	mockAgent.RegisterJSONHandler("/api/stacks/snap-stack/permissions", map[string]interface{}{
		"can_start": true, "can_stop": true, "can_restart": true,
	})
	mockAgent.RegisterJSONHandler("/api/stacks/can-create", map[string]interface{}{
		"can_create": true,
	})
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/system/info", map[string]interface{}{
		"docker_version": "24.0.0", "os": "linux",
	})
	mockAgent.RegisterJSONHandler("/api/system/permissions", map[string]interface{}{
		"docker": true, "compose": true,
	})
	mockAgent.RegisterJSONHandler("/api/registries", []interface{}{})

	sid := fmt.Sprintf("%d", serverID)

	t.Run("GET /api/v1/servers/:serverid/stacks", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/can-create", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/can-create")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/can-create", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/image-updates", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/image-updates")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/image-updates", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/statistics", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/statistics")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/statistics", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/maintenance/info", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/maintenance/info")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/maintenance/info", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/maintenance/permissions", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/maintenance/permissions")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/registries", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/registries")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/registries", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/registries", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/registries", map[string]interface{}{
			"url":      "https://registry.example.com",
			"username": "testuser",
			"password": "testpass",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/registries", resp)

		var result struct {
			Success bool `json:"success"`
			Data    struct {
				ID uint `json:"id"`
			} `json:"data"`
		}
		if resp.GetJSON(&result) == nil && result.Data.ID > 0 {
			regID := fmt.Sprintf("%d", result.Data.ID)

			t.Run("GET /api/v1/servers/:serverid/registries/:id", func(t *testing.T) {
				resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/registries/"+regID)
				sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/registries/:id", resp)
			})

			t.Run("PUT /api/v1/servers/:serverid/registries/:id", func(t *testing.T) {
				resp := jwtRequestJSON(t, app, adminToken, "PUT", "/api/v1/servers/"+sid+"/registries/"+regID, map[string]interface{}{
					"url":      "https://registry2.example.com",
					"username": "testuser2",
					"password": "testpass2",
				})
				sr.RecordAndAssert(t, "PUT", "/api/v1/servers/:serverid/registries/:id", resp)
			})

			t.Run("DELETE /api/v1/servers/:serverid/registries/:id", func(t *testing.T) {
				resp := jwtRequest(t, app, adminToken, "DELETE", "/api/v1/servers/"+sid+"/registries/"+regID)
				sr.RecordAndAssert(t, "DELETE", "/api/v1/servers/:serverid/registries/:id", resp)
			})
		}
	})

	stack := "snap-stack"

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack)
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/compose", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/compose")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/compose", resp)
	})

	t.Run("PATCH /api/v1/servers/:serverid/stacks/:stackname/compose", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "PATCH", "/api/v1/servers/"+sid+"/stacks/"+stack+"/compose", map[string]interface{}{
			"content": "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
		})
		sr.RecordAndAssert(t, "PATCH", "/api/v1/servers/:serverid/stacks/:stackname/compose", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/networks", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/networks")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/networks", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/volumes", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/volumes")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/volumes", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/environment", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/environment")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/environment", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/images", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/images")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/images", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/stats", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/stats")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/stats", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/logs", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/logs")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/logs", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/containers/snap-stack-web-1/logs")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/permissions", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/permissions")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/permissions", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/read", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/read?path=docker-compose.yml")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/read", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/stats", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/stats")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/stats", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/write", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/write", map[string]interface{}{
			"path":    "test.txt",
			"content": "test content",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/write", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/mkdir", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/mkdir", map[string]interface{}{
			"path": "testdir",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/mkdir", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/rename", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/rename", map[string]interface{}{
			"old_path": "test.txt",
			"new_path": "test2.txt",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/rename", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/copy", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/copy", map[string]interface{}{
			"source":      "test.txt",
			"destination": "test-copy.txt",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/copy", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/chmod", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/chmod", map[string]interface{}{
			"path": "test.txt",
			"mode": "0644",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/chmod", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/chown", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/chown", map[string]interface{}{
			"path":  "test.txt",
			"owner": "root:root",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/chown", resp)
	})

	t.Run("DELETE /api/v1/servers/:serverid/stacks/:stackname/files/delete", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + sid + "/stacks/" + stack + "/files/delete?path=test.txt",
			Headers: map[string]string{
				"Authorization": "Bearer " + adminToken,
			},
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "DELETE", "/api/v1/servers/:serverid/stacks/:stackname/files/delete", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/maintenance/prune", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/maintenance/prune", map[string]interface{}{
			"type": "images",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", resp)
	})

	t.Run("DELETE /api/v1/servers/:serverid/maintenance/resource", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + sid + "/maintenance/resource",
			Body: map[string]interface{}{
				"type": "image",
				"id":   "sha256:abc123",
			},
			Headers: map[string]string{
				"Authorization": "Bearer " + adminToken,
			},
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/operations", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/operations", map[string]interface{}{
			"action": "restart",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/operations", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/vulnscan", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/vulnscan")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/vulnscan/history", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/vulnscan/history")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan/history", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/vulnscan/trend", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/vulnscan/trend")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan/trend", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/vulnscan", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/vulnscan", nil)
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", resp)
	})

	t.Run("GET /api/v1/vulnscan/:scanid", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/vulnscan/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/vulnscan/:scanid", resp)
	})

	t.Run("GET /api/v1/vulnscan/:scanid/summary", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/vulnscan/999999/summary")
		sr.RecordAndAssert(t, "GET", "/api/v1/vulnscan/:scanid/summary", resp)
	})

	t.Run("GET /api/v1/vulnscan/compare/:baseScanId/:compareScanId", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/vulnscan/compare/999998/999999")
		sr.RecordAndAssert(t, "GET", "/api/v1/vulnscan/compare/:baseScanId/:compareScanId", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks", map[string]interface{}{
			"name":           "new-snap-stack",
			"compose_config": "version: '3'\nservices:\n  web:\n    image: nginx\n",
		})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks", resp)
	})

	t.Run("GET /api/v1/servers/:serverid/stacks/:stackname/files/download", func(t *testing.T) {
		resp := jwtRequest(t, app, adminToken, "GET", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/download")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers/:serverid/stacks/:stackname/files/download", resp)
	})

	t.Run("POST /api/v1/servers/:serverid/stacks/:stackname/files/upload", func(t *testing.T) {
		resp := jwtRequestJSON(t, app, adminToken, "POST", "/api/v1/servers/"+sid+"/stacks/"+stack+"/files/upload", map[string]interface{}{})
		sr.RecordAndAssert(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/files/upload", resp)
	})
}
