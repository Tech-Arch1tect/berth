package engine

import (
	"sort"
	"testing"

	"berth/internal/domain/apikey"
	usermodel "berth/internal/domain/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func scopeWithStack(permName string, serverID *uint, stackPattern string) apikey.APIKeyScope {
	return apikey.APIKeyScope{
		ServerID:     serverID,
		StackPattern: stackPattern,
		Permission:   usermodel.Permission{Name: permName},
	}
}

func sortedUints(ids []uint) []uint {
	out := make([]uint, len(ids))
	copy(out, ids)
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

func TestAuthorizedScope_SystemPrincipal(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	scope, err := e.AuthorizedScope(SystemPrincipal)
	require.NoError(t, err)

	t.Run("allows any server", func(t *testing.T) {
		assert.True(t, scope.AllowsServer(f.serverID))
		assert.True(t, scope.AllowsServer(f.serverID+9999))
	})

	t.Run("allows any stack", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "any-stack"))
		assert.True(t, scope.AllowsStack(f.serverID+9999, "other-stack"))
	})

	t.Run("ServerIDs includes seeded server", func(t *testing.T) {
		ids := scope.ServerIDs()
		assert.Contains(t, ids, f.serverID)
	})
}

func TestAuthorizedScope_AdminUser(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	p := principalFor(t, f, f.adminUserID)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("allows seeded server", func(t *testing.T) {
		assert.True(t, scope.AllowsServer(f.serverID))
	})

	t.Run("AllowsStack true for any stack on accessible server", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "any-stack"))
		assert.True(t, scope.AllowsStack(f.serverID, "prod-web"))
	})

	t.Run("ServerIDs lists all servers", func(t *testing.T) {
		ids := scope.ServerIDs()
		assert.Contains(t, ids, f.serverID)
	})
}

func TestAuthorizedScope_ScopedNonAdminUser(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	p := principalFor(t, f, f.userID)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("allows server where role grants stacks.read", func(t *testing.T) {
		assert.True(t, scope.AllowsServer(f.serverID))
	})

	t.Run("AllowsStack true when stack matches role pattern", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "my-stack"))
	})

	t.Run("AllowsServer false for server user has no role on", func(t *testing.T) {
		assert.False(t, scope.AllowsServer(f.serverID+9999))
	})

	t.Run("AllowsStack false for server user has no role on", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID+9999, "my-stack"))
	})

	t.Run("ServerIDs contains only accessible server", func(t *testing.T) {
		ids := sortedUints(scope.ServerIDs())
		assert.Equal(t, []uint{f.serverID}, ids)
	})
}

func TestAuthorizedScope_ScopedNonAdminUser_PatternFiltering(t *testing.T) {
	f := seedFixtureWithPattern(t, "prod-*")
	e := New(f.db, zap.NewNop())

	p := principalFor(t, f.fixture, f.userID)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("AllowsStack true when name matches pattern", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "prod-web"))
	})

	t.Run("AllowsStack false when name does not match pattern", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID, "staging-web"))
	})
}

func TestAuthorizedScope_NoRoleUser(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	p := principalFor(t, f, f.noRoleUserID)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("empty ServerIDs", func(t *testing.T) {
		assert.Empty(t, scope.ServerIDs())
	})

	t.Run("AllowsServer false", func(t *testing.T) {
		assert.False(t, scope.AllowsServer(f.serverID))
	})

	t.Run("AllowsStack false", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID, "my-stack"))
	})
}

func TestAuthorizedScope_APIKey_ServerIntersection(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("key scope locked to matching server preserves access", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, ptr(f.serverID), "*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.True(t, scope.AllowsServer(f.serverID))
		assert.Contains(t, scope.ServerIDs(), f.serverID)
	})

	t.Run("key scope locked to different server removes access", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, ptr(f.serverID+99), "*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.False(t, scope.AllowsServer(f.serverID))
		assert.Empty(t, scope.ServerIDs())
	})

	t.Run("key scope with nil ServerID does not narrow server set", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, nil, "*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.True(t, scope.AllowsServer(f.serverID))
		assert.Contains(t, scope.ServerIDs(), f.serverID)
	})
}

func TestAuthorizedScope_APIKey_StackIntersection(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("key stack pattern matches allows stack", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, nil, "my-*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.True(t, scope.AllowsStack(f.serverID, "my-stack"))
	})

	t.Run("key stack pattern does not match denies stack", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, nil, "other-*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.False(t, scope.AllowsStack(f.serverID, "my-stack"))
	})

	t.Run("key permission mismatch denies stack even with matching pattern", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack("stacks.manage", nil, "*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.False(t, scope.AllowsStack(f.serverID, "my-stack"))
	})

	t.Run("key scope server mismatch denies stack", func(t *testing.T) {
		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, ptr(f.serverID+99), "*"),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.False(t, scope.AllowsStack(f.serverID, "my-stack"))
	})

	t.Run("role grants but key absent means stack allowed", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.True(t, scope.AllowsStack(f.serverID, "my-stack"))
	})
}

type patternFixture struct {
	*fixture
}

func seedFixtureWithPattern(t *testing.T, stackPattern string) *patternFixture {
	t.Helper()
	db := testDB(t)

	var perm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testPermName).First(&perm).Error)

	server := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{
		Name:        "pattern-server",
		Host:        "localhost",
		Port:        2376,
		AccessToken: "tok",
	}
	require.NoError(t, db.Table("servers").Create(&server).Error)

	role := usermodel.Role{Name: "patternrole", Description: "test", IsAdmin: false}
	require.NoError(t, db.Create(&role).Error)

	srsp := usermodel.ServerRoleStackPermission{
		ServerID:     server.ID,
		RoleID:       role.ID,
		PermissionID: perm.ID,
		StackPattern: stackPattern,
	}
	require.NoError(t, db.Create(&srsp).Error)

	u := usermodel.User{Username: "patternuser", Email: "patternuser@example.com", Password: "x"}
	require.NoError(t, db.Create(&u).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, role.ID).Error)

	noRoleUser := usermodel.User{Username: "norole2", Email: "norole2@example.com", Password: "x"}
	require.NoError(t, db.Create(&noRoleUser).Error)

	var adminRole usermodel.Role
	require.NoError(t, db.Where("name = ? AND is_admin = ?", "admin", true).First(&adminRole).Error)
	adminUser := usermodel.User{Username: "sysadmin2", Email: "sysadmin2@example.com", Password: "x"}
	require.NoError(t, db.Create(&adminUser).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", adminUser.ID, adminRole.ID).Error)

	return &patternFixture{
		fixture: &fixture{
			db:           db,
			userID:       u.ID,
			adminUserID:  adminUser.ID,
			noRoleUserID: noRoleUser.ID,
			roleID:       role.ID,
			serverID:     server.ID,
			permID:       perm.ID,
		},
	}
}

func TestAuthorizedScope_DuplicatePatternDeduplication(t *testing.T) {
	db := testDB(t)

	var perm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testPermName).First(&perm).Error)

	server1 := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{
		Name:        "dedup-server-1",
		Host:        "localhost",
		Port:        2376,
		AccessToken: "tok1",
	}
	require.NoError(t, db.Table("servers").Create(&server1).Error)

	server2 := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{
		Name:        "dedup-server-2",
		Host:        "localhost",
		Port:        2377,
		AccessToken: "tok2",
	}
	require.NoError(t, db.Table("servers").Create(&server2).Error)

	role := usermodel.Role{Name: "deduplicated-role", Description: "test dedup", IsAdmin: false}
	require.NoError(t, db.Create(&role).Error)

	srsp1 := usermodel.ServerRoleStackPermission{
		ServerID:     server1.ID,
		RoleID:       role.ID,
		PermissionID: perm.ID,
		StackPattern: "prod-*",
	}
	require.NoError(t, db.Create(&srsp1).Error)

	srsp2 := usermodel.ServerRoleStackPermission{
		ServerID:     server1.ID,
		RoleID:       role.ID,
		PermissionID: perm.ID,
		StackPattern: "prod-*",
	}
	require.NoError(t, db.Create(&srsp2).Error)

	srsp3 := usermodel.ServerRoleStackPermission{
		ServerID:     server2.ID,
		RoleID:       role.ID,
		PermissionID: perm.ID,
		StackPattern: "staging-*",
	}
	require.NoError(t, db.Create(&srsp3).Error)

	u := usermodel.User{Username: "dedup-user", Email: "dedup-user@example.com", Password: "x"}
	require.NoError(t, db.Create(&u).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, role.ID).Error)

	e := New(db, zap.NewNop())

	p := Principal{UserID: u.ID}
	require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)
	p.Roles = u.Roles

	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("duplicate pattern deduplicated for server", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(server1.ID, "prod-alpha"))
		assert.True(t, scope.AllowsStack(server1.ID, "prod-beta"))
		assert.False(t, scope.AllowsStack(server1.ID, "staging-alpha"))
	})

	t.Run("ServerIDs returns sorted ascending order", func(t *testing.T) {
		ids := scope.ServerIDs()
		require.Equal(t, 2, len(ids))

		firstCall := ids
		p2 := Principal{UserID: u.ID}
		require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)
		p2.Roles = u.Roles
		scope2, err := e.AuthorizedScope(p2)
		require.NoError(t, err)

		secondCall := scope2.ServerIDs()
		assert.Equal(t, firstCall, secondCall)
		assert.True(t, firstCall[0] < firstCall[1], "server IDs should be in ascending order")
	})
}
