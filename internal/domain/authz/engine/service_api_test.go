package engine

import (
	"testing"

	"berth/internal/domain/authz"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func keyWith(scopes ...authz.KeyScope) *authz.KeyDescriptor {
	return &authz.KeyDescriptor{ID: 1, Scopes: scopes}
}

func TestPrincipalForUser(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("regular user", func(t *testing.T) {
		p, err := e.PrincipalForUser(f.userID)
		require.NoError(t, err)
		assert.Equal(t, f.userID, p.UserID())
		assert.False(t, p.IsAdmin())
		assert.Nil(t, p.Key())
	})

	t.Run("admin user is detected", func(t *testing.T) {
		p, err := e.PrincipalForUser(f.adminUserID)
		require.NoError(t, err)
		assert.True(t, p.IsAdmin())
	})

	t.Run("unknown user is an error, never a principal", func(t *testing.T) {
		_, err := e.PrincipalForUser(99999)
		require.Error(t, err)
	})
}

func TestServiceAPI_HasStackPermission(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())
	user := authz.NewPrincipal(f.userID, false, nil)

	t.Run("role grant admits", func(t *testing.T) {
		ok, err := e.HasStackPermission(user, f.serverID, testStackName, testPermName)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("missing permission denies", func(t *testing.T) {
		ok, err := e.HasStackPermission(user, f.serverID, testStackName, "stacks.manage")
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key scope intersects: matching scope admits", func(t *testing.T) {
		p := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{StackPattern: "*", Permission: testPermName}))
		ok, err := e.HasStackPermission(p, f.serverID, testStackName, testPermName)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("key scope intersects: scopeless key denies", func(t *testing.T) {
		p := authz.NewPrincipal(f.userID, false, keyWith())
		ok, err := e.HasStackPermission(p, f.serverID, testStackName, testPermName)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key cannot exceed its owner: scope without role grant denies", func(t *testing.T) {
		p := authz.NewPrincipal(f.noRoleUserID, false, keyWith(authz.KeyScope{StackPattern: "*", Permission: testPermName}))
		ok, err := e.HasStackPermission(p, f.serverID, testStackName, testPermName)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("unauthenticated principal denies", func(t *testing.T) {
		ok, err := e.HasStackPermission(authz.Principal{}, f.serverID, testStackName, testPermName)
		require.NoError(t, err)
		assert.False(t, ok)
	})
}

func TestServiceAPI_HasServerPermissionAndAccess(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())
	user := authz.NewPrincipal(f.userID, false, nil)

	t.Run("server permission via role grant", func(t *testing.T) {
		ok, err := e.HasServerPermission(user, f.serverID, testPermName)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("server permission denied for ungranted permission", func(t *testing.T) {
		ok, err := e.HasServerPermission(user, f.serverID, "stacks.manage")
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("server access via any grant", func(t *testing.T) {
		ok, err := e.HasServerAccess(user, f.serverID)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("server access denied without grants", func(t *testing.T) {
		ok, err := e.HasServerAccess(authz.NewPrincipal(f.noRoleUserID, false, nil), f.serverID)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("server access with key requires a covering scope", func(t *testing.T) {
		other := uint(4242)
		denied := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{ServerID: &other, StackPattern: "*", Permission: testPermName}))
		ok, err := e.HasServerAccess(denied, f.serverID)
		require.NoError(t, err)
		assert.False(t, ok)

		covering := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{ServerID: &f.serverID, StackPattern: "*", Permission: testPermName}))
		ok, err = e.HasServerAccess(covering, f.serverID)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestServiceAPI_StackPermissions(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("role permissions listed for matching stack", func(t *testing.T) {
		perms, err := e.StackPermissions(authz.NewPrincipal(f.userID, false, nil), f.serverID, testStackName)
		require.NoError(t, err)
		assert.Equal(t, []string{testPermName}, perms)
	})

	t.Run("key scopes filter the disclosure", func(t *testing.T) {
		p := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{StackPattern: "other-*", Permission: testPermName}))
		perms, err := e.StackPermissions(p, f.serverID, testStackName)
		require.NoError(t, err)
		assert.Empty(t, perms,
			"a key scoped to other stacks must not be told the owner's permissions on this one")
	})

	t.Run("unknown user has no permissions", func(t *testing.T) {
		perms, err := e.StackPermissions(authz.NewPrincipal(99999, false, nil), f.serverID, testStackName)
		require.NoError(t, err)
		assert.Empty(t, perms)
	})
}

func TestServiceAPI_ReachableServerIDs(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("role reach via stacks.read grants", func(t *testing.T) {
		ids, err := e.ReachableServerIDs(authz.NewPrincipal(f.userID, false, nil))
		require.NoError(t, err)
		assert.Equal(t, []uint{f.serverID}, ids)
	})

	t.Run("admin reaches every server", func(t *testing.T) {
		ids, err := e.ReachableServerIDs(authz.NewPrincipal(f.adminUserID, true, nil))
		require.NoError(t, err)
		assert.Contains(t, ids, f.serverID)
	})

	t.Run("server-bound key scopes narrow the reach", func(t *testing.T) {
		other := uint(4242)
		p := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{ServerID: &other, StackPattern: "*", Permission: testPermName}))
		ids, err := e.ReachableServerIDs(p)
		require.NoError(t, err)
		assert.Empty(t, ids)
	})

	t.Run("any server-wide scope leaves the owner's reach intact", func(t *testing.T) {
		p := authz.NewPrincipal(f.userID, false, keyWith(authz.KeyScope{StackPattern: "*", Permission: testPermName}))
		ids, err := e.ReachableServerIDs(p)
		require.NoError(t, err)
		assert.Equal(t, []uint{f.serverID}, ids)
	})

	t.Run("no roles, no reach", func(t *testing.T) {
		ids, err := e.ReachableServerIDs(authz.NewPrincipal(f.noRoleUserID, false, nil))
		require.NoError(t, err)
		assert.Empty(t, ids)
	})
}
