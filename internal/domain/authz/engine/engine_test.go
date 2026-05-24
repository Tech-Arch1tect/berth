package engine

import (
	"fmt"
	"sync/atomic"
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/authz"
	usermodel "berth/internal/domain/user"
	"berth/seeds"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var dbCounter atomic.Int64

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:authz_test_%d?mode=memory&cache=shared", dbCounter.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(seeds.RBACModels()...)
	require.NoError(t, err)
	require.NoError(t, seeds.SeedRBACData(db))
	return db
}

type fixture struct {
	db           *gorm.DB
	userID       uint
	adminUserID  uint
	noRoleUserID uint
	roleID       uint
	serverID     uint
	permID       uint
}

const testStackName = "my-stack"
const testPermName = "stacks.read"
const testAdminPermName = "admin.users.read"

func seedFixture(t *testing.T) *fixture {
	t.Helper()
	db := testDB(t)

	var perm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testPermName).First(&perm).Error)

	var adminPerm usermodel.Permission
	require.NoError(t, db.Where("name = ?", testAdminPermName).First(&adminPerm).Error)

	server := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{
		Name:        "test-server",
		Host:        "localhost",
		Port:        2376,
		AccessToken: "tok",
	}
	require.NoError(t, db.Table("servers").Create(&server).Error)

	role := usermodel.Role{Name: "testoperator", Description: "test", IsAdmin: false}
	require.NoError(t, db.Create(&role).Error)

	srsp := usermodel.ServerRoleStackPermission{
		ServerID:     server.ID,
		RoleID:       role.ID,
		PermissionID: perm.ID,
		StackPattern: "*",
	}
	require.NoError(t, db.Create(&srsp).Error)

	u := usermodel.User{Username: "eng1", Email: "eng1@example.com", Password: "x"}
	require.NoError(t, db.Create(&u).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, role.ID).Error)

	var adminRole usermodel.Role
	require.NoError(t, db.Where("name = ? AND is_admin = ?", "admin", true).First(&adminRole).Error)
	adminUser := usermodel.User{Username: "sysadmin", Email: "sysadmin@example.com", Password: "x"}
	require.NoError(t, db.Create(&adminUser).Error)
	require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", adminUser.ID, adminRole.ID).Error)

	noRoleUser := usermodel.User{Username: "norole", Email: "norole@example.com", Password: "x"}
	require.NoError(t, db.Create(&noRoleUser).Error)

	var loaded usermodel.User
	require.NoError(t, db.Preload("Roles").First(&loaded, u.ID).Error)
	var adminLoaded usermodel.User
	require.NoError(t, db.Preload("Roles").First(&adminLoaded, adminUser.ID).Error)

	return &fixture{
		db:           db,
		userID:       u.ID,
		adminUserID:  adminUser.ID,
		noRoleUserID: noRoleUser.ID,
		roleID:       role.ID,
		serverID:     server.ID,
		permID:       perm.ID,
	}
}

func principalFor(t *testing.T, f *fixture, userID uint) Principal {
	t.Helper()
	var u usermodel.User
	require.NoError(t, f.db.Preload("Roles").First(&u, userID).Error)
	return Principal{UserID: u.ID, Roles: u.Roles}
}

func withAPIKey(p Principal, scopes ...apikey.APIKeyScope) Principal {
	p.APIKey = &apikey.APIKey{Scopes: scopes}
	return p
}

func scopeForPerm(permName string, serverID *uint) apikey.APIKeyScope {
	return apikey.APIKeyScope{
		ServerID:     serverID,
		StackPattern: "*",
		Permission:   usermodel.Permission{Name: permName},
	}
}

func ptr[T any](v T) *T { return &v }

func TestAuthorize_KindAuthenticated(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	t.Run("non-zero UserID is authenticated", func(t *testing.T) {
		ok, err := e.Authorize(Principal{UserID: 1}, authz.Requirement{Kind: authz.KindAuthenticated})
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("zero UserID is not authenticated", func(t *testing.T) {
		ok, err := e.Authorize(Principal{UserID: 0}, authz.Requirement{Kind: authz.KindAuthenticated})
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("with API key, non-zero UserID is authenticated", func(t *testing.T) {
		p := withAPIKey(Principal{UserID: 1}, scopeForPerm(testPermName, nil))
		ok, err := e.Authorize(p, authz.Requirement{Kind: authz.KindAuthenticated})
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, authz.Requirement{Kind: authz.KindAuthenticated})
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindAdmin(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	req := authz.Requirement{Kind: authz.KindAdmin, Permission: testAdminPermName}

	t.Run("admin role grants admin permission", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("non-admin role denies admin permission", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("admin role AND key scope grants", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		p = withAPIKey(p, scopeForPerm(testAdminPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("admin role BUT key scope absent denies", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		p = withAPIKey(p, scopeForPerm("admin.other.perm", nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key scope present BUT role denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testAdminPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindServerAccess(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	req := authz.Requirement{Kind: authz.KindServerAccess, ServerID: f.serverID}

	t.Run("role grants server access", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("no role denies server access", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("admin role grants server access", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope (wildcard server) grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope (matching server) grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, ptr(f.serverID)))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role BUT key scope locked to different server denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, ptr(f.serverID+99)))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key scope present BUT role denies", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		p = withAPIKey(p, scopeForPerm(testPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindServer(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	req := authz.Requirement{Kind: authz.KindServer, ServerID: f.serverID, Permission: testPermName}

	t.Run("role grants server permission", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("no role denies server permission", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("admin role grants server permission", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope (matching server) grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, ptr(f.serverID)))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role BUT key scope has wrong permission denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm("stacks.manage", nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("role BUT key scope locked to different server denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm(testPermName, ptr(f.serverID+99)))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key scope present BUT role denies", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		p = withAPIKey(p, scopeForPerm(testPermName, nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindStack(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	req := authz.Requirement{
		Kind:       authz.KindStack,
		ServerID:   f.serverID,
		Stack:      testStackName,
		Permission: testPermName,
	}

	t.Run("role grants stack permission", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("no role denies stack permission", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("admin role grants stack permission", func(t *testing.T) {
		p := principalFor(t, f, f.adminUserID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, apikey.APIKeyScope{
			ServerID:     nil,
			StackPattern: "*",
			Permission:   usermodel.Permission{Name: testPermName},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role AND key scope (matching server and stack) grants", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, apikey.APIKeyScope{
			ServerID:     ptr(f.serverID),
			StackPattern: "my-*",
			Permission:   usermodel.Permission{Name: testPermName},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("role BUT key scope stack pattern does not match denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, apikey.APIKeyScope{
			ServerID:     nil,
			StackPattern: "other-*",
			Permission:   usermodel.Permission{Name: testPermName},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("role BUT key scope has wrong permission denies", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, apikey.APIKeyScope{
			ServerID:     nil,
			StackPattern: "*",
			Permission:   usermodel.Permission{Name: "stacks.manage"},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("key scope present BUT role denies", func(t *testing.T) {
		p := principalFor(t, f, f.noRoleUserID)
		p = withAPIKey(p, apikey.APIKeyScope{
			ServerID:     nil,
			StackPattern: "*",
			Permission:   usermodel.Permission{Name: testPermName},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_MultipleRequirements(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	authReq := authz.Requirement{Kind: authz.KindAuthenticated}
	serverReq := authz.Requirement{Kind: authz.KindServerAccess, ServerID: f.serverID}
	adminReq := authz.Requirement{Kind: authz.KindAdmin, Permission: testAdminPermName}

	t.Run("all satisfied returns true", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, authReq, serverReq)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("one unsatisfied returns false", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, authReq, serverReq, adminReq)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("zero requirements returns true", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindAPIKeyScope(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	req := authz.Requirement{Kind: authz.KindAPIKeyScope, Permission: "servers.read"}

	t.Run("JWT principal (no API key) is allowed", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("API key principal with matching scope is allowed", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm("servers.read", nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("API key principal with only unrelated scope is denied", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p, scopeForPerm("logs.operations.read", nil))
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("API key principal with no scopes is denied", func(t *testing.T) {
		p := principalFor(t, f, f.userID)
		p = withAPIKey(p)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("SystemPrincipal is always allowed", func(t *testing.T) {
		ok, err := e.Authorize(SystemPrincipal, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_UnknownKind(t *testing.T) {
	f := seedFixture(t)
	e := New(f.db, zap.NewNop())

	p := principalFor(t, f, f.userID)
	_, err := e.Authorize(p, authz.Requirement{Kind: authz.Kind(999)})
	assert.Error(t, err)
}

func TestAuthorize_KindStack_StacksReadPrerequisite(t *testing.T) {
	db := testDB(t)

	var stacksRead, filesRead usermodel.Permission
	require.NoError(t, db.Where("name = ?", "stacks.read").First(&stacksRead).Error)
	require.NoError(t, db.Where("name = ?", "files.read").First(&filesRead).Error)

	srv := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "prereq-server", Host: "localhost", Port: 2376, AccessToken: "tok"}
	require.NoError(t, db.Table("servers").Create(&srv).Error)

	roleFilesOnly := usermodel.Role{Name: "files-only", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleFilesOnly).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleFilesOnly.ID, PermissionID: filesRead.ID, StackPattern: "prod-*",
	}).Error)

	roleBoth := usermodel.Role{Name: "files-and-stacks", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleBoth).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleBoth.ID, PermissionID: filesRead.ID, StackPattern: "prod-*",
	}).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleBoth.ID, PermissionID: stacksRead.ID, StackPattern: "prod-*",
	}).Error)

	mkUser := func(name string, roleID uint) Principal {
		u := usermodel.User{Username: name, Email: name + "@example.com", Password: "x"}
		require.NoError(t, db.Create(&u).Error)
		require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, roleID).Error)
		require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)
		return Principal{UserID: u.ID, Roles: u.Roles}
	}

	pFilesOnly := mkUser("files-only-user", roleFilesOnly.ID)
	pBoth := mkUser("both-user", roleBoth.ID)

	var adminRole usermodel.Role
	require.NoError(t, db.Where("name = ? AND is_admin = ?", "admin", true).First(&adminRole).Error)
	pAdmin := mkUser("prereq-admin", adminRole.ID)

	e := New(db, zap.NewNop())
	req := authz.Requirement{
		Kind: authz.KindStack, ServerID: srv.ID, Stack: "prod-web", Permission: "files.read",
	}

	t.Run("user with only files.read is denied (missing stacks.read prerequisite)", func(t *testing.T) {
		ok, err := e.Authorize(pFilesOnly, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("user with files.read AND stacks.read is admitted", func(t *testing.T) {
		ok, err := e.Authorize(pBoth, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("admin user is admitted regardless", func(t *testing.T) {
		ok, err := e.Authorize(pAdmin, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("API key with only files.read scope is denied", func(t *testing.T) {
		p := withAPIKey(pBoth, apikey.APIKeyScope{
			ServerID: &srv.ID, StackPattern: "prod-*",
			Permission: usermodel.Permission{Name: "files.read"},
		})
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.False(t, ok, "key scope is missing the stacks.read prerequisite")
	})

	t.Run("API key with both files.read and stacks.read scopes is admitted", func(t *testing.T) {
		p := withAPIKey(pBoth,
			apikey.APIKeyScope{ServerID: &srv.ID, StackPattern: "prod-*", Permission: usermodel.Permission{Name: "files.read"}},
			apikey.APIKeyScope{ServerID: &srv.ID, StackPattern: "prod-*", Permission: usermodel.Permission{Name: "stacks.read"}},
		)
		ok, err := e.Authorize(p, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("Stack(stacks.read) is admitted without the prerequisite path running twice", func(t *testing.T) {
		ok, err := e.Authorize(pBoth, authz.Requirement{
			Kind: authz.KindStack, ServerID: srv.ID, Stack: "prod-web", Permission: "stacks.read",
		})
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindServer_StacksReadPrerequisite(t *testing.T) {
	db := testDB(t)

	var stacksRead, maintRead usermodel.Permission
	require.NoError(t, db.Where("name = ?", "stacks.read").First(&stacksRead).Error)
	require.NoError(t, db.Where("name = ?", "docker.maintenance.read").First(&maintRead).Error)

	srv := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "srv-prereq", Host: "localhost", Port: 2376, AccessToken: "tok"}
	require.NoError(t, db.Table("servers").Create(&srv).Error)

	roleMaintOnly := usermodel.Role{Name: "maint-only", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleMaintOnly).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleMaintOnly.ID, PermissionID: maintRead.ID, StackPattern: "*",
	}).Error)

	roleBoth := usermodel.Role{Name: "maint-and-stacks", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleBoth).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleBoth.ID, PermissionID: maintRead.ID, StackPattern: "*",
	}).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleBoth.ID, PermissionID: stacksRead.ID, StackPattern: "*",
	}).Error)

	mkUser := func(name string, roleID uint) Principal {
		u := usermodel.User{Username: name, Email: name + "@example.com", Password: "x"}
		require.NoError(t, db.Create(&u).Error)
		require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, roleID).Error)
		require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)
		return Principal{UserID: u.ID, Roles: u.Roles}
	}

	pMaintOnly := mkUser("maint-only-user", roleMaintOnly.ID)
	pBoth := mkUser("maint-both-user", roleBoth.ID)

	e := New(db, zap.NewNop())
	req := authz.Requirement{
		Kind: authz.KindServer, ServerID: srv.ID, Permission: "docker.maintenance.read",
	}

	t.Run("user with only docker.maintenance.read is denied", func(t *testing.T) {
		ok, err := e.Authorize(pMaintOnly, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("user with both perms is admitted", func(t *testing.T) {
		ok, err := e.Authorize(pBoth, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestAuthorize_KindServerAccess_RequiresStacksRead(t *testing.T) {
	db := testDB(t)

	var stacksRead, logsRead usermodel.Permission
	require.NoError(t, db.Where("name = ?", "stacks.read").First(&stacksRead).Error)
	require.NoError(t, db.Where("name = ?", "logs.read").First(&logsRead).Error)

	srv := struct {
		ID          uint   `gorm:"primarykey"`
		Name        string `gorm:"not null"`
		Host        string `gorm:"not null"`
		Port        int    `gorm:"not null"`
		AccessToken string `gorm:"not null"`
	}{Name: "srv-sa", Host: "localhost", Port: 2376, AccessToken: "tok"}
	require.NoError(t, db.Table("servers").Create(&srv).Error)

	roleLogsOnly := usermodel.Role{Name: "logs-only", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleLogsOnly).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleLogsOnly.ID, PermissionID: logsRead.ID, StackPattern: "*",
	}).Error)

	roleStacks := usermodel.Role{Name: "stacks-only", Description: "", IsAdmin: false}
	require.NoError(t, db.Create(&roleStacks).Error)
	require.NoError(t, db.Create(&usermodel.ServerRoleStackPermission{
		ServerID: srv.ID, RoleID: roleStacks.ID, PermissionID: stacksRead.ID, StackPattern: "*",
	}).Error)

	mkUser := func(name string, roleID uint) Principal {
		u := usermodel.User{Username: name, Email: name + "@example.com", Password: "x"}
		require.NoError(t, db.Create(&u).Error)
		require.NoError(t, db.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?,?)", u.ID, roleID).Error)
		require.NoError(t, db.Preload("Roles").First(&u, u.ID).Error)
		return Principal{UserID: u.ID, Roles: u.Roles}
	}

	pLogsOnly := mkUser("sa-logs-only", roleLogsOnly.ID)
	pStacks := mkUser("sa-stacks", roleStacks.ID)

	e := New(db, zap.NewNop())
	req := authz.Requirement{Kind: authz.KindServerAccess, ServerID: srv.ID}

	t.Run("user with only logs.read does not have ServerAccess", func(t *testing.T) {
		ok, err := e.Authorize(pLogsOnly, req)
		require.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("user with stacks.read has ServerAccess", func(t *testing.T) {
		ok, err := e.Authorize(pStacks, req)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}
