package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/domain/maintenance"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type SystemInfoData = maintenance.MaintenanceInfo

type PruneResponse struct {
	Type           string   `json:"type"`
	ItemsDeleted   []string `json:"items_deleted"`
	SpaceReclaimed int64    `json:"space_reclaimed"`
	Error          string   `json:"error,omitempty"`
}

type DeleteResourceResponse struct {
	Type    string `json:"type"`
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type RegistryCredentialResponse struct {
	ID           uint   `json:"id"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
	ServerID     uint   `json:"server_id"`
	StackPattern string `json:"stack_pattern"`
	RegistryURL  string `json:"registry_url"`
	ImagePattern string `json:"image_pattern"`
	Username     string `json:"username"`
}

type RegistryCredentialsListResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Credentials []RegistryCredentialResponse `json:"credentials"`
	} `json:"data"`
}

type SingleRegistryCredentialResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Credential RegistryCredentialResponse `json:"credential"`
	} `json:"data"`
}

func TestMaintenancePermissionsJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancepermuser",
		Email:    "maintenancepermuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-perm-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	t.Run("GET /api/servers/:serverid/maintenance/permissions returns permissions", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp response.Response[maintenance.PermissionsData]
		require.NoError(t, resp.GetJSON(&permsResp))

		assert.True(t, permsResp.Success)
		assert.True(t, permsResp.Data.Maintenance.Read)
		assert.True(t, permsResp.Data.Maintenance.Write)
	})

	t.Run("GET /api/servers/:serverid/maintenance/permissions returns permissions for any server ID", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/99999/maintenance/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp response.Response[maintenance.PermissionsData]
		require.NoError(t, resp.GetJSON(&permsResp))

		assert.True(t, permsResp.Success)
		assert.True(t, permsResp.Data.Maintenance.Read)
		assert.True(t, permsResp.Data.Maintenance.Write)
	})
}

func TestMaintenanceInfoJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenanceinfouser",
		Email:    "maintenanceinfouser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-info-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/info", map[string]interface{}{
		"system_info": map[string]interface{}{
			"version":        "24.0.7",
			"api_version":    "1.43",
			"architecture":   "x86_64",
			"os":             "linux",
			"kernel_version": "6.1.0",
		},
		"image_summary": map[string]interface{}{
			"total":        map[string]interface{}{"count": 15, "size": 5368709120},
			"unused_count": 5,
			"images": []interface{}{
				map[string]interface{}{
					"id":          "aaa111",
					"tags":        []interface{}{"registry.example.com:8888/demo:latest"},
					"size":        134217728,
					"shared_size": 12582912,
					"containers":  0,
					"dangling":    false,
					"unused":      true,
					"removal":     "with_all",
				},
				map[string]interface{}{
					"id":          "bbb222",
					"tags":        []interface{}{},
					"size":        67108864,
					"shared_size": -1,
					"containers":  0,
					"dangling":    true,
					"unused":      true,
					"removal":     "always",
				},
			},
		},
		"container_summary": map[string]interface{}{
			"total":         map[string]interface{}{"count": 7, "size": 536870912},
			"running_count": 5,
			"containers":    []interface{}{},
		},
		"volume_summary": map[string]interface{}{
			"total":   map[string]interface{}{"count": 10, "size": 1073741824},
			"unused":  map[string]interface{}{"count": 3, "size": 268435456},
			"volumes": []interface{}{},
		},
		"network_summary": map[string]interface{}{
			"total_count":  8,
			"unused_count": 2,
			"networks":     []interface{}{},
		},
		"build_cache_summary": map[string]interface{}{
			"total": map[string]interface{}{"count": 20, "size": 268435456},
			"cache": []interface{}{},
		},
		"system_cleanup_covers": []interface{}{"images", "containers", "networks", "build_cache"},
		"last_updated":          "2024-01-15T14:00:00Z",
	})

	t.Run("GET /api/servers/:serverid/maintenance/info returns system info", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/info",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var infoResp response.Response[SystemInfoData]
		require.NoError(t, resp.GetJSON(&infoResp))
		assert.True(t, infoResp.Success)
		assert.Equal(t, "24.0.7", infoResp.Data.SystemInfo.Version)
		assert.Equal(t, "1.43", infoResp.Data.SystemInfo.APIVersion)

		assert.Equal(t, maintenance.Amount{Count: 15, Size: 5368709120}, infoResp.Data.ImageSummary.Total)
		assert.Equal(t, 5, infoResp.Data.ImageSummary.UnusedCount)
		assert.Equal(t, maintenance.Amount{Count: 7, Size: 536870912}, infoResp.Data.ContainerSummary.Total)
		assert.Equal(t, maintenance.Amount{Count: 10, Size: 1073741824}, infoResp.Data.VolumeSummary.Total)
		assert.Equal(t, maintenance.Amount{Count: 3, Size: 268435456}, infoResp.Data.VolumeSummary.Unused)
		assert.Equal(t, maintenance.Amount{Count: 20, Size: 268435456}, infoResp.Data.BuildCacheSummary.Total)

		assert.Equal(t, []string{"images", "containers", "networks", "build_cache"}, infoResp.Data.SystemCleanupCovers)
		assert.NotContains(t, infoResp.Data.SystemCleanupCovers, "volumes")

		require.Len(t, infoResp.Data.ImageSummary.Images, 2)
		tagged := infoResp.Data.ImageSummary.Images[0]
		assert.Equal(t, []string{"registry.example.com:8888/demo:latest"}, tagged.Tags)
		assert.Equal(t, maintenance.RemovalWithAll, tagged.Removal)
		assert.EqualValues(t, 12582912, tagged.SharedSize)

		untagged := infoResp.Data.ImageSummary.Images[1]
		assert.Empty(t, untagged.Tags)
		assert.Equal(t, maintenance.RemovalAlways, untagged.Removal)
		assert.EqualValues(t, -1, untagged.SharedSize)
	})
}

func TestMaintenancePruneJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancepruneuser",
		Email:    "maintenancepruneuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-prune-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/prune", map[string]interface{}{
		"type":            "images",
		"items_deleted":   []string{"sha256:abc123", "sha256:def456"},
		"space_reclaimed": 268435456,
	})

	t.Run("POST /api/servers/:serverid/maintenance/prune requires type", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/prune",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/servers/:serverid/maintenance/prune rejects invalid type", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/prune",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"type": "invalid-type",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("POST /api/servers/:serverid/maintenance/prune accepts valid prune types", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		validTypes := []string{"images", "containers", "volumes", "networks", "build-cache", "system"}

		for _, pruneType := range validTypes {
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method: "POST",
				Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/prune",
				Headers: map[string]string{
					"Authorization": "Bearer " + token,
					"Content-Type":  "application/json",
				},
				Body: map[string]interface{}{
					"type": pruneType,
				},
			})
			require.NoError(t, err, "prune type %s should be accepted", pruneType)
			assert.Equal(t, 200, resp.StatusCode, "prune type %s should return 200", pruneType)
		}
	})
}

func TestMaintenanceDeleteResourceJWT(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancedeleteuser",
		Email:    "maintenancedeleteuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, loginResp.GetJSON(&login))
	token := login.Data.AccessToken

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-delete-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/resource", map[string]interface{}{
		"type":    "image",
		"id":      "sha256:abc123",
		"success": true,
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource requires type", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/resource",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"id": "sha256:abc123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource requires id", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/resource",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"type": "image",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource rejects invalid type", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/resource",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
				"Content-Type":  "application/json",
			},
			Body: map[string]interface{}{
				"type": "invalid-type",
				"id":   "sha256:abc123",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource deletes valid resource", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		validTypes := []string{"image", "container", "volume", "network"}

		for _, resourceType := range validTypes {
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method: "DELETE",
				Path:   "/api/v1/servers/" + Itoa(testServer.ID) + "/maintenance/resource",
				Headers: map[string]string{
					"Authorization": "Bearer " + token,
					"Content-Type":  "application/json",
				},
				Body: map[string]interface{}{
					"type": resourceType,
					"id":   "test-resource-id",
				},
			})
			require.NoError(t, err, "resource type %s should be accepted", resourceType)
			assert.Equal(t, 200, resp.StatusCode, "resource type %s should return 200", resourceType)
		}
	})
}

func TestMaintenanceEndpointsSessionAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancesessionuser",
		Email:    "maintenancesessionuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)
	mockAgent, testServer := app.CreateTestServerWithAgent(t, "test-server-maintenance-session")

	mockAgent.RegisterJSONHandler("/api/maintenance/resource", map[string]interface{}{
		"success": true,
		"message": "Resource deleted successfully",
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource works with session auth", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.DeleteWithBody("/api/v1/servers/"+Itoa(testServer.ID)+"/maintenance/resource", map[string]interface{}{
			"type": "image",
			"id":   "test-image-id",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestMaintenanceEndpointsNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("GET /api/v1/servers/:serverid/maintenance/permissions requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/permissions", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers/1/maintenance/permissions")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/maintenance/info requires authentication", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/maintenance/info", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Get("/api/v1/servers/1/maintenance/info")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/maintenance/prune requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/maintenance/prune", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Post("/api/v1/servers/1/maintenance/prune", map[string]interface{}{
			"type": "images",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/maintenance/resource requires authentication", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/maintenance/resource", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/1/maintenance/resource",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: map[string]interface{}{
				"type": "image",
				"id":   "test",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}

func TestRegistryCredentialsSessionAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "registryuser",
		Email:    "registryuser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)

	sessionClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "registry-test-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	var createdCredentialID uint

	t.Run("GET /api/v1/servers/:serverid/registries returns empty list initially", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/" + Itoa(testServer.ID) + "/registries")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credsResp RegistryCredentialsListResponse
		require.NoError(t, resp.GetJSON(&credsResp))
		assert.Empty(t, credsResp.Data.Credentials)
	})

	t.Run("POST /api/v1/servers/:serverid/registries creates credential", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/registries", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		resp, err := sessionClient.Post("/api/v1/servers/"+Itoa(testServer.ID)+"/registries", map[string]interface{}{
			"registry_url":  "ghcr.io",
			"username":      "testuser",
			"password":      "testtoken",
			"stack_pattern": "production-*",
			"image_pattern": "myorg/*",
		})
		require.NoError(t, err)
		assert.Equal(t, 201, resp.StatusCode)

		var credResp SingleRegistryCredentialResponse
		require.NoError(t, resp.GetJSON(&credResp))
		assert.Equal(t, "ghcr.io", credResp.Data.Credential.RegistryURL)
		assert.Equal(t, "testuser", credResp.Data.Credential.Username)
		assert.Equal(t, "production-*", credResp.Data.Credential.StackPattern)
		assert.Equal(t, "myorg/*", credResp.Data.Credential.ImagePattern)
		createdCredentialID = credResp.Data.Credential.ID
	})

	t.Run("POST /api/v1/servers/:serverid/registries requires registry_url", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/registries", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := sessionClient.Post("/api/v1/servers/"+Itoa(testServer.ID)+"/registries", map[string]interface{}{
			"username": "testuser",
			"password": "testtoken",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/registries returns created credential", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/" + Itoa(testServer.ID) + "/registries")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credsResp RegistryCredentialsListResponse
		require.NoError(t, resp.GetJSON(&credsResp))
		assert.Len(t, credsResp.Data.Credentials, 1)
		assert.Equal(t, "ghcr.io", credsResp.Data.Credentials[0].RegistryURL)
	})

	t.Run("GET /api/v1/servers/:serverid/registries/:id returns single credential", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryHappyPath, e2etesting.ValueMedium)
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Get("/api/v1/servers/" + Itoa(testServer.ID) + "/registries/" + Itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credResp SingleRegistryCredentialResponse
		require.NoError(t, resp.GetJSON(&credResp))
		assert.Equal(t, createdCredentialID, credResp.Data.Credential.ID)
		assert.Equal(t, "ghcr.io", credResp.Data.Credential.RegistryURL)
	})

	t.Run("GET /api/v1/servers/:serverid/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Get("/api/v1/servers/" + Itoa(testServer.ID) + "/registries/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("PUT /api/v1/servers/:serverid/registries/:id updates credential", func(t *testing.T) {
		TagTest(t, "PUT", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Put("/api/v1/servers/"+Itoa(testServer.ID)+"/registries/"+Itoa(createdCredentialID), map[string]interface{}{
			"registry_url":  "ghcr.io",
			"username":      "updateduser",
			"password":      "updatedtoken",
			"stack_pattern": "staging-*",
			"image_pattern": "myorg/*",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credResp SingleRegistryCredentialResponse
		require.NoError(t, resp.GetJSON(&credResp))
		assert.Equal(t, createdCredentialID, credResp.Data.Credential.ID)
		assert.Equal(t, "updateduser", credResp.Data.Credential.Username)
		assert.Equal(t, "staging-*", credResp.Data.Credential.StackPattern)
	})

	t.Run("PUT /api/v1/servers/:serverid/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		TagTest(t, "PUT", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Put("/api/v1/servers/"+Itoa(testServer.ID)+"/registries/99999", map[string]interface{}{
			"username": "testuser",
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/registries/:id deletes credential", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Delete("/api/v1/servers/" + Itoa(testServer.ID) + "/registries/" + Itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/v1/servers/" + Itoa(testServer.ID) + "/registries/" + Itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 404, getResp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		TagTest(t, "DELETE", "/api/v1/servers/:serverid/registries/:id", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := sessionClient.Delete("/api/v1/servers/" + Itoa(testServer.ID) + "/registries/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

}

func TestRegistryEndpointsNoAuth(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("POST /api/v1/servers/:serverid/registries requires authentication", func(t *testing.T) {
		TagTest(t, "POST", "/api/v1/servers/:serverid/registries", e2etesting.CategoryNoAuth, e2etesting.ValueLow)
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/1/registries",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: map[string]interface{}{
				"registry_url": "ghcr.io",
				"username":     "test",
				"password":     "test",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})
}
