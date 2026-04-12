package e2e

import (
	"flag"
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

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/admin/servers"},
		{"GET", "/admin/roles"},
		{"GET", "/admin/users"},
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

	t.Run("GET /api/v1/profile unauth", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/profile")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "GET", "/api/v1/profile_unauth", resp)
	})

	t.Run("GET /api/v1/servers unauth", func(t *testing.T) {
		resp, err := app.HTTPClient.Get("/api/v1/servers")
		require.NoError(t, err)
		sr.RecordAndAssert(t, "GET", "/api/v1/servers_unauth", resp)
	})
}
func TestSnapshotAuthenticatedAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	user := &e2etesting.TestUser{
		Username: "snapapiuser",
		Email:    "snapapiuser@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: user.Username,
		Password: user.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	accessToken := login.Data.AccessToken

	sr.RecordAndAssert(t, "POST", "/api/v1/auth/login", loginResp)

	authedRequest := func(method, path string) *e2etesting.Response {
		t.Helper()
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: method,
			Path:   path,
			Headers: map[string]string{
				"Authorization": "Bearer " + accessToken,
			},
		})
		require.NoError(t, err)
		return resp
	}

	t.Run("GET /api/v1/profile", func(t *testing.T) {
		resp := authedRequest("GET", "/api/v1/profile")
		sr.RecordAndAssert(t, "GET", "/api/v1/profile", resp)
	})

	t.Run("GET /api/v1/servers", func(t *testing.T) {
		resp := authedRequest("GET", "/api/v1/servers")
		sr.RecordAndAssert(t, "GET", "/api/v1/servers", resp)
	})

	t.Run("GET /api/v1/totp/status", func(t *testing.T) {
		resp := authedRequest("GET", "/api/v1/totp/status")
		sr.RecordAndAssert(t, "GET", "/api/v1/totp/status", resp)
	})
}
func TestSnapshotAdminAPI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	sr := e2etesting.NewSnapshotRecorder(snapshotDir(), *updateSnapshots)

	adminUser := &e2etesting.TestUser{
		Username: "snapadminapi",
		Email:    "snapadminapi@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, adminUser)

	loginResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
		Username: adminUser.Username,
		Password: adminUser.Password,
	})
	require.NoError(t, err)
	require.Equal(t, 200, loginResp.StatusCode)

	var login handlers.AuthLoginResponse
	require.NoError(t, loginResp.GetJSON(&login))
	accessToken := login.Data.AccessToken

	authedRequest := func(method, path string) *e2etesting.Response {
		t.Helper()
		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: method,
			Path:   path,
			Headers: map[string]string{
				"Authorization": "Bearer " + accessToken,
			},
		})
		require.NoError(t, err)
		return resp
	}

	t.Run("GET /api/v1/admin/roles", func(t *testing.T) {
		resp := authedRequest("GET", "/api/v1/admin/roles")
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/roles", resp)
	})

	t.Run("GET /api/v1/admin/users", func(t *testing.T) {
		resp := authedRequest("GET", "/api/v1/admin/users")
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/users", resp)
	})

	t.Run("GET /api/v1/admin/roles forbidden", func(t *testing.T) {
		normalUser := &e2etesting.TestUser{
			Username: "snapnormalapi",
			Email:    "snapnormalapi@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, normalUser)
		nResp, err := app.HTTPClient.Post("/api/v1/auth/login", handlers.AuthLoginRequest{
			Username: normalUser.Username,
			Password: normalUser.Password,
		})
		require.NoError(t, err)
		var nLogin handlers.AuthLoginResponse
		require.NoError(t, nResp.GetJSON(&nLogin))

		resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
			Method: "GET",
			Path:   "/api/v1/admin/roles",
			Headers: map[string]string{
				"Authorization": "Bearer " + nLogin.Data.AccessToken,
			},
		})
		require.NoError(t, err)
		sr.RecordAndAssert(t, "GET", "/api/v1/admin/roles_forbidden", resp)
	})
}
