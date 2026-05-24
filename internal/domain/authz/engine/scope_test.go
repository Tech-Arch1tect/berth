package engine

import (
	"slices"
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

func TestAuthorizedScope_PatternMatching(t *testing.T) {
	cases := []struct {
		name        string
		pattern     string
		stack       string
		wantAllowed bool
	}{
		{"exact match", "prod-web", "prod-web", true},
		{"exact mismatch", "prod-web", "prod-db", false},
		{"prefix wildcard matches", "prod-*", "prod-web", true},
		{"prefix wildcard mismatch", "prod-*", "staging-web", false},
		{"suffix wildcard matches", "*-web", "prod-web", true},
		{"suffix wildcard mismatch", "*-web", "prod-db", false},
		{"infix wildcard matches", "prod-*-v1", "prod-web-v1", true},
		{"infix wildcard mismatch suffix", "prod-*-v1", "prod-web-v2", false},
		{"multi wildcard matches", "*prod*web*", "x-prod-y-web-z", true},
		{"multi wildcard mismatch", "*prod*web*", "x-staging-y-z", false},
		{"global wildcard matches anything", "*", "anything-goes", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := seedFixtureWithPattern(t, tc.pattern)
			e := New(f.db, zap.NewNop())

			p := principalFor(t, f.fixture, f.userID)
			scope, err := e.AuthorizedScope(p)
			require.NoError(t, err)

			assert.Equal(t, tc.wantAllowed, scope.AllowsStack(f.serverID, tc.stack),
				"pattern %q vs stack %q", tc.pattern, tc.stack)
		})
	}
}

func TestAuthorizedScope_OverlappingPatternsSameRole(t *testing.T) {
	db := testDB(t)

	var perm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testPermName).First(&perm).Error)

	srv := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "overlap-server", Host: "localhost", Port: 2376, AccessToken: "tok"}
	require.NoError(t, db.Table("servers").Create(&srv).Error)

	role := usermodel.Role{Name: "overlap-role", Description: "overlap", IsAdmin: false}
	require.NoError(t, db.Create(&role).Error)

	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: role.ID, PermissionID: perm.ID, StackPattern: "prod-*",
	}).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: role.ID, PermissionID: perm.ID, StackPattern: "prod-web",
	}).Error)

	u := usermodel.User{Username: "overlap-user", Email: "overlap-user@example.com", Password: "x"}
	require.NoError(t, db.Create(&u).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, role.ID).Error)
	require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)

	e := New(db, zap.NewNop())
	scope, err := e.AuthorizedScope(Principal{UserID: u.ID, Roles: u.Roles})
	require.NoError(t, err)

	t.Run("specific pattern still matches", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(srv.ID, "prod-web"))
	})
	t.Run("broader pattern still matches", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(srv.ID, "prod-db"))
	})
	t.Run("out-of-pattern still denied", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(srv.ID, "staging-web"))
	})
}

func TestAuthorizedScope_MultiRoleUnion(t *testing.T) {
	db := testDB(t)

	var perm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testPermName).First(&perm).Error)

	srv := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "union-server", Host: "localhost", Port: 2376, AccessToken: "tok"}
	require.NoError(t, db.Table("servers").Create(&srv).Error)

	roleA := usermodel.Role{Name: "prod-role", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleA).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleA.ID, PermissionID: perm.ID, StackPattern: "prod-*",
	}).Error)

	roleB := usermodel.Role{Name: "ops-role", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleB).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleB.ID, PermissionID: perm.ID, StackPattern: "ops-*",
	}).Error)

	u := usermodel.User{Username: "union-user", Email: "union-user@example.com", Password: "x"}
	require.NoError(t, db.Create(&u).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, roleA.ID).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, roleB.ID).Error)
	require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)

	e := New(db, zap.NewNop())
	scope, err := e.AuthorizedScope(Principal{UserID: u.ID, Roles: u.Roles})
	require.NoError(t, err)

	t.Run("pattern from role A allowed", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(srv.ID, "prod-web"))
	})
	t.Run("pattern from role B allowed", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(srv.ID, "ops-db"))
	})
	t.Run("stack matching neither pattern denied", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(srv.ID, "staging-web"))
	})
}

func TestAuthorizedScope_APIKey_IntersectsWiderRolePattern(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	p := withAPIKey(principalFor(t, f, f.userID),
		scopeWithStack(testPermName, nil, "prod-*"),
	)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("in-key pattern allowed", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "prod-web"))
	})
	t.Run("role-allowed-but-key-restricted denied", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID, "staging-web"))
	})
}

func TestAuthorizedScope_APIKey_PatternIntersectionEmpty(t *testing.T) {
	f := seedFixtureWithPattern(t, "prod-*")
	e := New(f.db, zap.NewNop())

	p := withAPIKey(principalFor(t, f.fixture, f.userID),
		scopeWithStack(testPermName, nil, "staging-*"),
	)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("role-only-allowed denied by key", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID, "prod-web"))
	})
	t.Run("key-only-allowed denied by role", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(f.serverID, "staging-web"))
	})
}

func TestAuthorizedScope_AdminWithKeyServerRestriction(t *testing.T) {
	f := seedFixture(t)

	srv2 := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "admin-narrow-second", Host: "localhost", Port: 2377, AccessToken: "tok2"}
	require.NoError(t, f.db.Table("servers").Create(&srv2).Error)

	e := New(f.db, zap.NewNop())

	p := withAPIKey(principalFor(t, f, f.adminUserID),
		scopeWithStack(testPermName, ptr(f.serverID), "*"),
	)
	scope, err := e.AuthorizedScope(p)
	require.NoError(t, err)

	t.Run("admin scope narrows to keyed server", func(t *testing.T) {
		assert.True(t, scope.AllowsServer(f.serverID))
		assert.False(t, scope.AllowsServer(srv2.ID))
	})
	t.Run("admin sees other server denied via key intersection", func(t *testing.T) {
		assert.False(t, scope.AllowsStack(srv2.ID, "any-stack"))
	})
	t.Run("admin retains all-stacks on keyed server", func(t *testing.T) {
		assert.True(t, scope.AllowsStack(f.serverID, "any-stack"))
	})
}

func TestAuthorizedScope_EmptyAndMalformedPatterns(t *testing.T) {
	t.Run("empty role pattern stored as wildcard via DB default", func(t *testing.T) {
		f := seedFixtureWithPattern(t, "")
		e := New(f.db, zap.NewNop())

		p := principalFor(t, f.fixture, f.userID)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.True(t, scope.AllowsStack(f.serverID, "anything"),
			"empty StackPattern should resolve to wildcard via gorm default")
	})

	t.Run("empty in-memory key pattern matches only empty stack name", func(t *testing.T) {
		f := seedFixture(t)
		e := New(f.db, zap.NewNop())

		p := withAPIKey(principalFor(t, f, f.userID),
			scopeWithStack(testPermName, nil, ""),
		)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)
		assert.False(t, scope.AllowsStack(f.serverID, "prod-web"))
	})

	t.Run("non-glob characters treated literally", func(t *testing.T) {
		f := seedFixtureWithPattern(t, "[bad]")
		e := New(f.db, zap.NewNop())

		p := principalFor(t, f.fixture, f.userID)
		scope, err := e.AuthorizedScope(p)
		require.NoError(t, err)

		assert.False(t, scope.AllowsStack(f.serverID, "bad"),
			"square brackets should not act as a character class")
		assert.True(t, scope.AllowsStack(f.serverID, "[bad]"),
			"literal match of the pattern string")
	})
}

func TestFilterByListableScopes(t *testing.T) {
	roleSet := []uint{1, 2, 3}

	mkScope := func(perm string, serverID *uint) apikey.APIKeyScope {
		return apikey.APIKeyScope{
			ServerID:     serverID,
			StackPattern: "*",
			Permission:   usermodel.Permission{Name: perm},
		}
	}

	tests := []struct {
		name   string
		scopes []apikey.APIKeyScope
		want   []uint
	}{
		{
			name:   "no scopes returns empty",
			scopes: nil,
			want:   nil,
		},
		{
			name: "wildcard stacks.read preserves the role-derived set",
			scopes: []apikey.APIKeyScope{
				mkScope("stacks.read", nil),
			},
			want: roleSet,
		},
		{
			name: "per-server stacks.read narrows to that server",
			scopes: []apikey.APIKeyScope{
				mkScope("stacks.read", ptr(uint(1))),
			},
			want: []uint{1},
		},
		{
			name: "two per-server stacks.read scopes return their union",
			scopes: []apikey.APIKeyScope{
				mkScope("stacks.read", ptr(uint(1))),
				mkScope("stacks.read", ptr(uint(3))),
			},
			want: []uint{1, 3},
		},
		{
			name: "key with only servers.read on nil sees nothing",
			scopes: []apikey.APIKeyScope{
				mkScope("servers.read", nil),
			},
			want: nil,
		},
		{
			name: "key with only servers.read on a single server sees nothing",
			scopes: []apikey.APIKeyScope{
				mkScope("servers.read", ptr(uint(1))),
			},
			want: nil,
		},
		{
			name: "servers.read wildcard does not short-circuit a narrow stacks.read",
			scopes: []apikey.APIKeyScope{
				mkScope("servers.read", nil),
				mkScope("stacks.read", ptr(uint(1))),
			},
			want: []uint{1},
		},
		{
			name: "servers.read on a different server does not widen stacks.read scope",
			scopes: []apikey.APIKeyScope{
				mkScope("stacks.read", ptr(uint(1))),
				mkScope("servers.read", ptr(uint(2))),
			},
			want: []uint{1},
		},
		{
			name: "wildcard and per-server stacks.read together still preserve the role set",
			scopes: []apikey.APIKeyScope{
				mkScope("stacks.read", nil),
				mkScope("stacks.read", ptr(uint(1))),
			},
			want: roleSet,
		},
		{
			name: "files.read scopes do not contribute either",
			scopes: []apikey.APIKeyScope{
				mkScope("files.read", nil),
				mkScope("files.read", ptr(uint(2))),
			},
			want: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			key := &apikey.APIKey{Scopes: tc.scopes}
			got := filterByListableScopes(key, roleSet)

			gotSorted := append([]uint(nil), got...)
			wantSorted := append([]uint(nil), tc.want...)
			slices.Sort(gotSorted)
			slices.Sort(wantSorted)

			if len(gotSorted) == 0 {
				assert.Empty(t, gotSorted, "expected empty result")
			} else {
				assert.Equal(t, wantSorted, gotSorted)
			}
		})
	}
}
