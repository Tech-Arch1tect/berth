package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/version"
	"berth/internal/pkg/response"
	appversion "berth/version"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzVersion(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	path := "/api/v1/version"

	_, jwt := f.User("version-user")
	owner, _ := f.User("version-key-owner")
	keyNoScope := f.APIKeyFor(owner, "noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: path}, "", 401)
	})

	t.Run("JWT without roles receives the version", func(t *testing.T) {
		assert.Equal(t, appversion.Version, getVersionBody(t, app, path, bearer(jwt)))
	})

	t.Run("API key without scopes receives the version", func(t *testing.T) {
		assert.Equal(t, appversion.Version, getVersionBody(t, app, path, bearer(keyNoScope)))
	})
}

func getVersionBody(t *testing.T, app *e2e.TestApp, path, authHeader string) string {
	t.Helper()
	resp := mustRequest(t, app, http.MethodGet, path, authHeader)
	require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())
	var data response.Response[version.VersionData]
	require.NoError(t, resp.GetJSON(&data))
	return data.Data.Version
}
