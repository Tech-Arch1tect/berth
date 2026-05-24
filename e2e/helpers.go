package e2e

import (
	"strconv"
	"testing"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/user"

	"github.com/stretchr/testify/require"
)

func Itoa(n uint) string {
	return strconv.FormatUint(uint64(n), 10)
}

func GrantStacksReadPrerequisite(
	t *testing.T,
	adminClient *e2etesting.HTTPClient,
	roleID, serverID uint,
	stackPattern, grantedPermName string,
	allPerms []user.PermissionInfo,
) {
	t.Helper()
	if grantedPermName == permnames.StacksRead {
		return
	}
	var stacksReadID uint
	for _, p := range allPerms {
		if p.Name == permnames.StacksRead {
			stacksReadID = p.ID
			break
		}
	}
	require.NotZero(t, stacksReadID, "stacks.read permission not found in permissions list")

	resp, err := adminClient.Post(
		"/api/v1/admin/roles/"+Itoa(roleID)+"/stack-permissions",
		map[string]any{
			"server_id":     serverID,
			"permission_id": stacksReadID,
			"stack_pattern": stackPattern,
		},
	)
	require.NoError(t, err, "add stacks.read prerequisite")
	require.Equal(t, 201, resp.StatusCode,
		"add stacks.read prerequisite: %s", resp.GetString())
}

func AddAPIKeyStacksReadScope(
	t *testing.T,
	adminClient *e2etesting.HTTPClient,
	keyID, serverID uint,
	stackPattern, grantedPerm string,
) {
	t.Helper()
	if grantedPerm == permnames.StacksRead {
		return
	}
	resp, err := adminClient.Post(
		"/api/v1/api-keys/"+Itoa(keyID)+"/scopes",
		map[string]any{
			"server_id":     serverID,
			"stack_pattern": stackPattern,
			"permission":    permnames.StacksRead,
		},
	)
	require.NoError(t, err, "add stacks.read prerequisite scope")
	require.Equal(t, 201, resp.StatusCode,
		"add stacks.read prerequisite scope: %s", resp.GetString())
}
