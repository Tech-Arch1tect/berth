package authz

import (
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/user"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzProfile(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	path := "/api/v1/profile"

	owner, jwtOwner, roleName := f.UserWithRole("profile-owner", f.Server, permnames.StacksManage, "*")
	keyScoped := f.APIKeyFor(owner, "scoped-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})
	keyNoScope := f.APIKeyFor(owner, "noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: path}, "", 401)
	})

	t.Run("JWT user receives the full profile including roles", func(t *testing.T) {
		resp := mustRequest(t, app, http.MethodGet, path, bearer(jwtOwner))
		require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())

		var data response.Response[user.UserInfo]
		require.NoError(t, resp.GetJSON(&data))
		assert.Equal(t, owner.Username, data.Data.Username)
		assert.Equal(t, owner.Email, data.Data.Email)

		roleNames := make([]string, 0, len(data.Data.Roles))
		for _, r := range data.Data.Roles {
			roleNames = append(roleNames, r.Name)
		}
		assert.Contains(t, roleNames, roleName)
	})

	t.Run("API key receives only the owner's id and username", func(t *testing.T) {
		assertProfileIsBareIdentity(t, app, path, bearer(keyScoped), owner.Username)
	})

	t.Run("API key without scopes receives only the owner's id and username", func(t *testing.T) {
		assertProfileIsBareIdentity(t, app, path, bearer(keyNoScope), owner.Username)
	})
}

func assertProfileIsBareIdentity(t *testing.T, app *e2e.TestApp, path, authHeader, wantUsername string) {
	t.Helper()
	resp := mustRequest(t, app, http.MethodGet, path, authHeader)
	require.Equal(t, 200, resp.StatusCode, "body: %s", resp.GetString())

	var raw response.Response[map[string]any]
	require.NoError(t, resp.GetJSON(&raw))

	keys := make([]string, 0, len(raw.Data))
	for k := range raw.Data {
		keys = append(keys, k)
	}
	assert.ElementsMatch(t, []string{"id", "username"}, keys,
		"an API key must receive nothing beyond the owner's identity; body=%s", resp.GetString())
	assert.Equal(t, wantUsername, raw.Data["username"])
}
