package e2e

import (
	"encoding/json"
	"net/http"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func assertInertiaErrPage(t *testing.T, resp *e2etesting.Response, wantStatus int, wantMessage string) {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "text/html",
		"errpage should render HTML, got %s", resp.Header.Get("Content-Type"))
	assert.Equal(t, wantStatus, resp.StatusCode)

	raw := e2etesting.ExtractInertiaPageJSON(resp.Body)
	require.NotNil(t, raw, "no inertia data-page in body: %s", resp.GetString())

	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal(raw, &page))

	assert.Equal(t, "Errors/Generic", page.Component)
	assert.Equal(t, float64(wantStatus), page.Props["code"])
	assert.Equal(t, wantMessage, page.Props["message"])
}

func TestRegistryWebHandlerErrors(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "regerruser",
		Email:    "regerruser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /servers/:serverid/registries renders 404 errpage when server missing", func(t *testing.T) {
		TagTest(t, "GET", "/servers/:serverid/registries", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/servers/9999/registries")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "Server not found")
	})
}

func TestMaintenanceWebHandlerErrors(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "mainterruser",
		Email:    "mainterruser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /servers/:serverid/maintenance renders 404 errpage when server missing", func(t *testing.T) {
		TagTest(t, "GET", "/servers/:serverid/maintenance", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/servers/9999/maintenance")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "Server not found")
	})
}

func TestStackWebHandlerErrors(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "stackerruser",
		Email:    "stackerruser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /servers/:id/stacks renders 400 errpage on non-numeric id", func(t *testing.T) {
		TagTest(t, "GET", "/servers/:id/stacks", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		resp, err := client.Get("/servers/not-a-number/stacks")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusBadRequest, "Invalid server ID")
	})

	t.Run("GET /servers/:id/stacks renders 404 errpage when server missing", func(t *testing.T) {
		TagTest(t, "GET", "/servers/:id/stacks", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/servers/9999/stacks")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "Server not found")
	})

	t.Run("GET /servers/:serverid/stacks/:stackname renders 404 errpage when server missing", func(t *testing.T) {
		TagTest(t, "GET", "/servers/:serverid/stacks/:stackname", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/servers/9999/stacks/some-stack")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "Server not found")
	})
}

func TestRBACWebHandlerErrors(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	user := &e2etesting.TestUser{
		Username: "rbacerruser",
		Email:    "rbacerruser@example.com",
		Password: "password123",
	}
	app.CreateAdminTestUser(t, user)
	client := app.SessionHelper.SimulateLogin(t, app.AuthHelper, user.Username, user.Password)

	t.Run("GET /admin/users/:id/roles renders 404 errpage when user missing", func(t *testing.T) {
		TagTest(t, "GET", "/admin/users/:id/roles", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/admin/users/9999/roles")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "user not found")
	})

	t.Run("GET /admin/roles/:id/stack-permissions renders 404 errpage when role missing", func(t *testing.T) {
		TagTest(t, "GET", "/admin/roles/:id/stack-permissions", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp, err := client.Get("/admin/roles/9999/stack-permissions")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusNotFound, "role not found")
	})

	t.Run("GET /admin/roles/:id/stack-permissions renders 400 errpage for admin role", func(t *testing.T) {
		TagTest(t, "GET", "/admin/roles/:id/stack-permissions", e2etesting.CategoryValidation, e2etesting.ValueMedium)
		var adminRoleID uint
		require.NoError(t, app.DB.Table("roles").Where("name = ?", "admin").Pluck("id", &adminRoleID).Error)

		resp, err := client.Get("/admin/roles/" + itoa(adminRoleID) + "/stack-permissions")
		require.NoError(t, err)
		assertInertiaErrPage(t, resp, http.StatusBadRequest, "cannot manage server permissions for admin role")
	})
}
