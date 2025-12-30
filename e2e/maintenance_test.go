package e2e

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	e2etesting "github.com/tech-arch1tect/brx/testing"
)

type MaintenancePermissionsResponse struct {
	Maintenance struct {
		Read  bool `json:"read"`
		Write bool `json:"write"`
	} `json:"maintenance"`
}

type SystemInfoResponse struct {
	SystemInfo struct {
		Version       string `json:"version"`
		APIVersion    string `json:"api_version"`
		Architecture  string `json:"architecture"`
		OS            string `json:"os"`
		KernelVersion string `json:"kernel_version"`
	} `json:"system_info"`
	DiskUsage struct {
		LayersSize     int64 `json:"layers_size"`
		ImagesSize     int64 `json:"images_size"`
		ContainersSize int64 `json:"containers_size"`
		VolumesSize    int64 `json:"volumes_size"`
		BuildCacheSize int64 `json:"build_cache_size"`
		TotalSize      int64 `json:"total_size"`
	} `json:"disk_usage"`
}

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
	Credentials []RegistryCredentialResponse `json:"credentials"`
}

type SingleRegistryCredentialResponse struct {
	Credential RegistryCredentialResponse `json:"credential"`
}

func TestMaintenancePermissionsJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancepermuser",
		Email:    "maintenancepermuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-perm-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})

	t.Run("GET /api/servers/:serverid/maintenance/permissions returns permissions", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp MaintenancePermissionsResponse
		require.NoError(t, resp.GetJSON(&permsResp))

		assert.True(t, permsResp.Maintenance.Read)
		assert.True(t, permsResp.Maintenance.Write)
	})

	t.Run("GET /api/servers/:serverid/maintenance/permissions returns permissions for any server ID", func(t *testing.T) {

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/99999/maintenance/permissions",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var permsResp MaintenancePermissionsResponse
		require.NoError(t, resp.GetJSON(&permsResp))

		assert.True(t, permsResp.Maintenance.Read)
		assert.True(t, permsResp.Maintenance.Write)
	})
}

func TestMaintenanceInfoJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenanceinfouser",
		Email:    "maintenanceinfouser@example.com",
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
		"disk_usage": map[string]interface{}{
			"layers_size":      5368709120,
			"images_size":      2147483648,
			"containers_size":  536870912,
			"volumes_size":     1073741824,
			"build_cache_size": 268435456,
			"total_size":       9395240960,
		},
		"image_summary": map[string]interface{}{
			"total_count":    15,
			"dangling_count": 3,
			"unused_count":   5,
			"total_size":     2147483648,
			"images":         []interface{}{},
		},
		"container_summary": map[string]interface{}{
			"running_count": 5,
			"stopped_count": 2,
			"total_count":   7,
			"total_size":    536870912,
			"containers":    []interface{}{},
		},
		"volume_summary": map[string]interface{}{
			"total_count":  10,
			"unused_count": 3,
			"total_size":   1073741824,
			"volumes":      []interface{}{},
		},
		"network_summary": map[string]interface{}{
			"total_count":  8,
			"unused_count": 2,
			"networks":     []interface{}{},
		},
		"build_cache_summary": map[string]interface{}{
			"total_count": 20,
			"total_size":  268435456,
			"cache":       []interface{}{},
		},
		"last_updated": "2024-01-15T14:00:00Z",
	})

	t.Run("GET /api/servers/:serverid/maintenance/info returns system info", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/info",
			Headers: map[string]string{
				"Authorization": "Bearer " + token,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var infoResp SystemInfoResponse
		require.NoError(t, resp.GetJSON(&infoResp))
		assert.Equal(t, "24.0.7", infoResp.SystemInfo.Version)
		assert.Equal(t, "1.43", infoResp.SystemInfo.APIVersion)
	})
}

func TestMaintenancePruneJWT(t *testing.T) {
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancepruneuser",
		Email:    "maintenancepruneuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-prune-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/prune", map[string]interface{}{
		"type":            "images",
		"items_deleted":   []string{"sha256:abc123", "sha256:def456"},
		"space_reclaimed": 268435456,
	})

	t.Run("POST /api/servers/:serverid/maintenance/prune requires type", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/prune",
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/prune",
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
		validTypes := []string{"images", "containers", "volumes", "networks", "build-cache", "system"}

		for _, pruneType := range validTypes {
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method: "POST",
				Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/prune",
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
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "maintenancedeleteuser",
		Email:    "maintenancedeleteuser@example.com",
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

	mockAgent, testServer := app.CreateTestServerWithAgent(t, "maintenance-delete-server")
	mockAgent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	mockAgent.RegisterJSONHandler("/api/maintenance/resource", map[string]interface{}{
		"type":    "image",
		"id":      "sha256:abc123",
		"success": true,
	})

	t.Run("DELETE /api/servers/:serverid/maintenance/resource requires type", func(t *testing.T) {
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/resource",
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/resource",
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
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "DELETE",
			Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/resource",
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
		validTypes := []string{"image", "container", "volume", "network"}

		for _, resourceType := range validTypes {
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method: "DELETE",
				Path:   "/api/v1/servers/" + itoa(testServer.ID) + "/maintenance/resource",
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
		resp, err := sessionClient.DeleteWithBody("/api/servers/"+itoa(testServer.ID)+"/maintenance/resource", map[string]interface{}{
			"type": "image",
			"id":   "test-image-id",
		})
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestMaintenanceEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("GET /api/v1/servers/:serverid/maintenance/permissions requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/servers/1/maintenance/permissions")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("GET /api/v1/servers/:serverid/maintenance/info requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/servers/1/maintenance/info")
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("POST /api/v1/servers/:serverid/maintenance/prune requires authentication", func(t *testing.T) {
		resp, err := app.HTTPClient.Post("/api/v1/servers/1/maintenance/prune", map[string]interface{}{
			"type": "images",
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("DELETE /api/v1/servers/:serverid/maintenance/resource requires authentication", func(t *testing.T) {
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

	t.Run("DELETE /api/servers/:serverid/maintenance/resource redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().DeleteWithBody("/api/servers/1/maintenance/resource", map[string]interface{}{
			"type": "image",
			"id":   "test",
		})
		require.NoError(t, err)
		assert.Equal(t, 302, resp.StatusCode)
	})
}

func TestRegistryCredentialsSessionAuth(t *testing.T) {
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

	t.Run("GET /api/servers/:server_id/registries returns empty list initially", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/" + itoa(testServer.ID) + "/registries")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credsResp RegistryCredentialsListResponse
		require.NoError(t, resp.GetJSON(&credsResp))
		assert.Empty(t, credsResp.Credentials)
	})

	t.Run("POST /api/servers/:server_id/registries creates credential", func(t *testing.T) {
		resp, err := sessionClient.Post("/api/servers/"+itoa(testServer.ID)+"/registries", map[string]interface{}{
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
		assert.Equal(t, "ghcr.io", credResp.Credential.RegistryURL)
		assert.Equal(t, "testuser", credResp.Credential.Username)
		assert.Equal(t, "production-*", credResp.Credential.StackPattern)
		assert.Equal(t, "myorg/*", credResp.Credential.ImagePattern)
		createdCredentialID = credResp.Credential.ID
	})

	t.Run("POST /api/servers/:server_id/registries requires registry_url", func(t *testing.T) {
		resp, err := sessionClient.Post("/api/servers/"+itoa(testServer.ID)+"/registries", map[string]interface{}{
			"username": "testuser",
			"password": "testtoken",
		})
		require.NoError(t, err)
		assert.Equal(t, 400, resp.StatusCode)
	})

	t.Run("GET /api/servers/:server_id/registries returns created credential", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/" + itoa(testServer.ID) + "/registries")
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credsResp RegistryCredentialsListResponse
		require.NoError(t, resp.GetJSON(&credsResp))
		assert.Len(t, credsResp.Credentials, 1)
		assert.Equal(t, "ghcr.io", credsResp.Credentials[0].RegistryURL)
	})

	t.Run("GET /api/servers/:server_id/registries/:id returns single credential", func(t *testing.T) {
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Get("/api/servers/" + itoa(testServer.ID) + "/registries/" + itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		var credResp SingleRegistryCredentialResponse
		require.NoError(t, resp.GetJSON(&credResp))
		assert.Equal(t, createdCredentialID, credResp.Credential.ID)
		assert.Equal(t, "ghcr.io", credResp.Credential.RegistryURL)
	})

	t.Run("GET /api/servers/:server_id/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		resp, err := sessionClient.Get("/api/servers/" + itoa(testServer.ID) + "/registries/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("PUT /api/servers/:server_id/registries/:id updates credential", func(t *testing.T) {
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Put("/api/servers/"+itoa(testServer.ID)+"/registries/"+itoa(createdCredentialID), map[string]interface{}{
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
		assert.Equal(t, createdCredentialID, credResp.Credential.ID)
		assert.Equal(t, "updateduser", credResp.Credential.Username)
		assert.Equal(t, "staging-*", credResp.Credential.StackPattern)
	})

	t.Run("PUT /api/servers/:server_id/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		resp, err := sessionClient.Put("/api/servers/"+itoa(testServer.ID)+"/registries/99999", map[string]interface{}{
			"username": "testuser",
		})
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

	t.Run("DELETE /api/servers/:server_id/registries/:id deletes credential", func(t *testing.T) {
		require.NotZero(t, createdCredentialID, "credential must be created first")

		resp, err := sessionClient.Delete("/api/servers/" + itoa(testServer.ID) + "/registries/" + itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		getResp, err := sessionClient.Get("/api/servers/" + itoa(testServer.ID) + "/registries/" + itoa(createdCredentialID))
		require.NoError(t, err)
		assert.Equal(t, 404, getResp.StatusCode)
	})

	t.Run("DELETE /api/servers/:server_id/registries/:id returns 404 for non-existent credential", func(t *testing.T) {
		resp, err := sessionClient.Delete("/api/servers/" + itoa(testServer.ID) + "/registries/99999")
		require.NoError(t, err)
		assert.Equal(t, 404, resp.StatusCode)
	})

}

func TestRegistryEndpointsNoAuth(t *testing.T) {
	app := SetupTestApp(t)

	t.Run("POST /api/servers/:server_id/registries redirects without auth", func(t *testing.T) {
		resp, err := app.HTTPClient.WithoutRedirects().Request(&e2etesting.RequestOptions{
			Method: "POST",
			Path:   "/api/servers/1/registries",
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
		assert.Equal(t, 302, resp.StatusCode)
	})
}
