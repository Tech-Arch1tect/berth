package authz

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"

	"github.com/stretchr/testify/require"
)

func seedOperation(t *testing.T, f *AuthzFixture, opIDs *atomic.Int64, stackName, command string) string {
	t.Helper()

	id := fmt.Sprintf("stream-op-%d", opIDs.Add(1))
	f.Agent.RegisterJSONHandler("/api/stacks/"+stackName+"/operations", map[string]any{
		"operationId": id,
	})

	resp, err := f.AdminClient.Post(
		"/api/v1/servers/"+e2e.Itoa(f.Server.ID)+"/stacks/"+stackName+"/operations",
		map[string]any{"command": command, "options": []string{}, "services": []string{}},
	)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode, "seeding %s operation on %s: %s", command, stackName, resp.GetString())
	return id
}

func TestAuthzOperationStreamWebSocket(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)

	var opIDs atomic.Int64
	manageOpID := seedOperation(t, f, &opIDs, "prod-web", "restart")
	archiveOpID := seedOperation(t, f, &opIDs, "prod-web", "create-archive")

	sid := e2e.Itoa(f.Server.ID)
	streamURL := func(stack, opID string) string {
		return "/ws/api/servers/" + sid + "/stacks/" + stack + "/operations/" + opID
	}

	const admittedReachedHandler = http.StatusUpgradeRequired

	_, jwtManage, _ := f.UserWithRole("stream-manage", f.Server, permnames.StacksManage, "prod-*")
	_, jwtReadOnly, _ := f.UserWithRole("stream-read", f.Server, permnames.StacksRead, "prod-*")
	_, jwtFilesOnly := f.UserWithRoles("stream-files-only", []RoleSpec{
		{Name: "stream-fo", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
	})
	_, jwtAdmin := f.Admin("stream-admin")

	noScopeOwner, _, _ := f.UserWithRole("stream-noscope-owner", f.Server, permnames.StacksManage, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "stream-noscope-key", nil)

	manageOwner, _, _ := f.UserWithRole("stream-key-owner", f.Server, permnames.StacksManage, "prod-*")
	keyManage := f.APIKeyFor(manageOwner, "stream-manage-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksManage, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	readOwner, _, _ := f.UserWithRole("stream-readkey-owner", f.Server, permnames.StacksManage, "*")
	keyReadOnly := f.APIKeyFor(readOwner, "stream-read-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	t.Run("unauthenticated is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, "", 401)
	})
	t.Run("JWT with stacks.manage on the stack is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(jwtManage), admittedReachedHandler)
	})
	t.Run("JWT with only stacks.read is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(jwtReadOnly), 403)
	})
	t.Run("JWT admin is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(jwtAdmin), admittedReachedHandler)
	})

	t.Run("archive operation requires files.write, not stacks.manage", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", archiveOpID)}, bearer(jwtManage), 403)
	})
	t.Run("archive operation admits a files.write principal", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", archiveOpID)}, bearer(jwtFilesOnly), admittedReachedHandler)
	})
	t.Run("files.write principal is rejected for a non-archive operation", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(jwtFilesOnly), 403)
	})

	t.Run("operation reached through another stack's URL is not found", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("staging-web", manageOpID)}, bearer(jwtAdmin), 404)
	})
	t.Run("operation on another stack is indistinguishable from unknown for the unauthorised", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("staging-web", manageOpID)}, bearer(jwtManage), 403)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("staging-web", "no-such-operation")}, bearer(jwtManage), 403)
	})
	t.Run("unknown operation is rejected for a principal without stacks.manage", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", "no-such-operation")}, bearer(jwtReadOnly), 403)
	})
	t.Run("unknown operation is not found for a stacks.manage principal", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", "no-such-operation")}, bearer(jwtManage), 404)
	})

	t.Run("API key without scopes is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(keyNoScope), 403)
	})
	t.Run("API key with only the read scope is rejected", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(keyReadOnly), 403)
	})
	t.Run("API key with the manage scope is admitted to the handler", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: streamURL("prod-web", manageOpID)}, bearer(keyManage), admittedReachedHandler)
	})
}
