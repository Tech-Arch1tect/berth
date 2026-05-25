package authz

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"
	"berth/internal/domain/user"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/require"
)

func DefaultStackNames() []string {
	return []string{"prod-web", "prod-db", "staging-web", "ops-db"}
}

type ScopeSpec struct {
	Permission   string
	ServerID     *uint
	StackPattern string
}

type RoleGrant struct {
	Server       *server.Server
	Permission   string
	StackPattern string
}

type RoleSpec struct {
	Name   string
	Grants []RoleGrant
}

type AuthzFixture struct {
	T   *testing.T
	App *e2e.TestApp

	Server *server.Server
	Agent  *e2e.MockAgent

	AdminUser   *e2etesting.TestUser
	AdminClient *e2etesting.HTTPClient

	namespace string

	mu       sync.Mutex
	permIDs  map[string]uint
	userJWTs map[uint]string
	roleIDs  map[string]uint
	userIDs  map[string]uint
	keySeq   int
	roleSeq  int
}

func NewAuthzFixture(t *testing.T, app *e2e.TestApp) *AuthzFixture {
	t.Helper()

	ns := sanitizeNamespace(t.Name())

	f := &AuthzFixture{
		T:         t,
		App:       app,
		namespace: ns,
		permIDs:   map[string]uint{},
		userJWTs:  map[uint]string{},
		roleIDs:   map[string]uint{},
		userIDs:   map[string]uint{},
	}

	agent, srv := app.CreateTestServerWithAgent(t, ns+"-srv")
	agent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	registerDefaultStacks(agent)
	f.Server = srv
	f.Agent = agent

	admin, adminClient := f.createAdmin("admin")
	f.AdminUser = admin
	f.AdminClient = adminClient

	agent.ResetCalls()

	return f
}

func (f *AuthzFixture) AddServer(name string, stacks ...string) (*server.Server, *e2e.MockAgent) {
	f.T.Helper()
	agent, srv := f.App.CreateTestServerWithAgent(f.T, f.namespace+"-"+name)
	agent.RegisterJSONHandler("/api/health", map[string]string{"status": "ok"})
	if len(stacks) == 0 {
		registerDefaultStacks(agent)
	} else {
		registerStacks(agent, stacks)
	}
	agent.ResetCalls()
	return srv, agent
}

func (f *AuthzFixture) User(name string) (*e2etesting.TestUser, string) {
	f.T.Helper()
	u := f.createUser(name)
	jwt := f.App.AuthHelper.JWTLogin(f.T, u.Username, u.Password)
	f.recordJWT(u.ID, jwt)
	return u, jwt
}

func (f *AuthzFixture) UserWithRole(name string, srv *server.Server, perm, pattern string) (*e2etesting.TestUser, string, string) {
	f.T.Helper()
	u, jwt := f.User(name)
	roleName := f.uniqueRoleName(name)

	grants := []RoleGrant{{Server: srv, Permission: perm, StackPattern: pattern}}
	if perm != permnames.StacksRead {
		grants = append(grants, RoleGrant{
			Server: srv, Permission: permnames.StacksRead, StackPattern: pattern,
		})
	}
	f.createRole(roleName, grants)
	f.assignRole(u.ID, roleName)
	jwt = f.refreshJWT(u)
	return u, jwt, roleName
}

func (f *AuthzFixture) UserWithRoles(name string, roles []RoleSpec) (*e2etesting.TestUser, string) {
	f.T.Helper()
	u, jwt := f.User(name)
	for _, r := range roles {
		roleName := f.uniqueRoleName(r.Name)
		f.createRole(roleName, r.Grants)
		f.assignRole(u.ID, roleName)
	}
	jwt = f.refreshJWT(u)
	return u, jwt
}

func (f *AuthzFixture) Admin(name string) (*e2etesting.TestUser, string) {
	f.T.Helper()
	u, _ := f.createAdmin(name)
	jwt := f.App.AuthHelper.JWTLogin(f.T, u.Username, u.Password)
	f.recordJWT(u.ID, jwt)
	return u, jwt
}

func (f *AuthzFixture) APIKeyFor(owner *e2etesting.TestUser, name string, scopes []ScopeSpec) string {
	f.T.Helper()
	jwt := f.lookupJWT(owner)
	ownerClient := f.App.HTTPClient.WithBearerToken(jwt)

	keyName := f.uniqueKeyName(name)
	createResp, err := ownerClient.Post("/api/v1/api-keys", map[string]any{"name": keyName})
	require.NoError(f.T, err, "create API key")
	require.Equal(f.T, 201, createResp.StatusCode, "create API key: %s", createResp.GetString())

	var keyResult response.Response[apikey.CreateAPIKeyData]
	require.NoError(f.T, createResp.GetJSON(&keyResult))

	keyID := keyResult.Data.APIKey.ID
	for _, scope := range scopes {
		pattern := scope.StackPattern
		if pattern == "" {
			pattern = "*"
		}
		body := map[string]any{
			"server_id":     scope.ServerID,
			"stack_pattern": pattern,
			"permission":    scope.Permission,
		}
		resp, err := ownerClient.Post("/api/v1/api-keys/"+e2e.Itoa(keyID)+"/scopes", body)
		require.NoError(f.T, err, "add scope %+v", scope)
		require.Equal(f.T, 201, resp.StatusCode, "add scope %+v: %s", scope, resp.GetString())
	}

	return keyResult.Data.PlainKey
}

func (f *AuthzFixture) RevokeRole(targetUser *e2etesting.TestUser, roleName string) {
	f.T.Helper()
	roleID := f.lookupRoleID(roleName)
	resp, err := f.AdminClient.Post("/api/v1/admin/users/revoke-role", map[string]any{
		"user_id": targetUser.ID,
		"role_id": roleID,
	})
	require.NoError(f.T, err, "revoke-role")
	require.Equal(f.T, 200, resp.StatusCode, "revoke-role: %s", resp.GetString())
}

func (f *AuthzFixture) createUser(name string) *e2etesting.TestUser {
	username := f.uniqueUserName(name)
	u := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	f.App.AuthHelper.CreateTestUser(f.T, u)
	f.mu.Lock()
	f.userIDs[name] = u.ID
	f.mu.Unlock()
	return u
}

func (f *AuthzFixture) createAdmin(name string) (*e2etesting.TestUser, *e2etesting.HTTPClient) {
	username := f.uniqueUserName(name)
	u := &e2etesting.TestUser{
		Username: username,
		Email:    username + "@example.com",
		Password: "password123",
	}
	f.App.CreateAdminTestUser(f.T, u)
	f.mu.Lock()
	f.userIDs[name] = u.ID
	f.mu.Unlock()
	client := f.App.SessionHelper.SimulateLogin(f.T, f.App.AuthHelper, u.Username, u.Password)
	return u, client
}

func (f *AuthzFixture) recordJWT(userID uint, jwt string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.userJWTs[userID] = jwt
}

func (f *AuthzFixture) refreshJWT(u *e2etesting.TestUser) string {
	jwt := f.App.AuthHelper.JWTLogin(f.T, u.Username, u.Password)
	f.recordJWT(u.ID, jwt)
	return jwt
}

func (f *AuthzFixture) lookupJWT(u *e2etesting.TestUser) string {
	f.mu.Lock()
	jwt, ok := f.userJWTs[u.ID]
	f.mu.Unlock()
	require.True(f.T, ok, "AuthzFixture has no JWT recorded for user %q (id=%d) — was the user created via the fixture?", u.Username, u.ID)
	return jwt
}

func (f *AuthzFixture) createRole(roleName string, grants []RoleGrant) {
	f.T.Helper()
	roleResp, err := f.AdminClient.Post("/api/v1/admin/roles", map[string]any{
		"name":        roleName,
		"description": "authz fixture role",
	})
	require.NoError(f.T, err, "create role %q", roleName)
	require.Equal(f.T, 201, roleResp.StatusCode, "create role %q: %s", roleName, roleResp.GetString())

	var roleResult response.Response[user.RoleWithPermissions]
	require.NoError(f.T, roleResp.GetJSON(&roleResult))
	roleID := roleResult.Data.ID
	f.mu.Lock()
	f.roleIDs[roleName] = roleID
	f.mu.Unlock()

	for _, g := range grants {
		permID := f.permissionID(g.Permission)
		pattern := g.StackPattern
		if pattern == "" {
			pattern = "*"
		}
		body := map[string]any{
			"server_id":     g.Server.ID,
			"permission_id": permID,
			"stack_pattern": pattern,
		}
		resp, err := f.AdminClient.Post("/api/v1/admin/roles/"+e2e.Itoa(roleID)+"/stack-permissions", body)
		require.NoError(f.T, err, "add stack-permission to %q", roleName)
		require.Equal(f.T, 201, resp.StatusCode, "add stack-permission to %q: %s", roleName, resp.GetString())
	}
}

func (f *AuthzFixture) assignRole(userID uint, roleName string) {
	f.T.Helper()
	roleID := f.lookupRoleID(roleName)
	resp, err := f.AdminClient.Post("/api/v1/admin/users/assign-role", map[string]any{
		"user_id": userID,
		"role_id": roleID,
	})
	require.NoError(f.T, err, "assign-role %q", roleName)
	require.Equal(f.T, 200, resp.StatusCode, "assign-role %q: %s", roleName, resp.GetString())
}

func (f *AuthzFixture) permissionID(name string) uint {
	f.mu.Lock()
	if id, ok := f.permIDs[name]; ok {
		f.mu.Unlock()
		return id
	}
	f.mu.Unlock()

	resp, err := f.AdminClient.Get("/api/v1/admin/permissions")
	require.NoError(f.T, err, "list permissions")
	require.Equal(f.T, 200, resp.StatusCode, "list permissions: %s", resp.GetString())

	var list response.Response[rbac.ListPermissionsData]
	require.NoError(f.T, resp.GetJSON(&list))

	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range list.Data.Permissions {
		f.permIDs[p.Name] = p.ID
	}
	id, ok := f.permIDs[name]
	require.True(f.T, ok, "permission %q not found in /api/v1/admin/permissions", name)
	return id
}

func (f *AuthzFixture) lookupRoleID(roleName string) uint {
	f.mu.Lock()
	defer f.mu.Unlock()
	id, ok := f.roleIDs[roleName]
	require.True(f.T, ok, "AuthzFixture has no role recorded with name %q", roleName)
	return id
}

func (f *AuthzFixture) uniqueUserName(name string) string {
	return truncate(f.namespace+"-"+name, 48)
}

func (f *AuthzFixture) uniqueRoleName(name string) string {
	f.mu.Lock()
	f.roleSeq++
	seq := f.roleSeq
	f.mu.Unlock()
	return truncate(f.namespace+"-r"+e2e.Itoa(uint(seq))+"-"+name, 64)
}

func (f *AuthzFixture) uniqueKeyName(name string) string {
	f.mu.Lock()
	f.keySeq++
	seq := f.keySeq
	f.mu.Unlock()
	return truncate(f.namespace+"-k"+e2e.Itoa(uint(seq))+"-"+name, 64)
}

func registerDefaultStacks(agent *e2e.MockAgent) {
	registerStacks(agent, DefaultStackNames())
}

func registerStacks(agent *e2e.MockAgent, names []string) {
	list := make([]map[string]any, 0, len(names))
	for _, n := range names {
		list = append(list, map[string]any{"name": n, "status": "running"})
	}
	agent.RegisterJSONHandler("/api/stacks", list)
	for _, n := range names {
		agent.RegisterJSONHandler("/api/stacks/"+n, map[string]any{
			"name": n, "status": "running",
		})
	}
}

func sanitizeNamespace(name string) string {
	sum := sha256.Sum256([]byte(name))
	hash := hex.EncodeToString(sum[:])[:8]

	lower := strings.ToLower(name)
	var b strings.Builder
	for _, r := range lower {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '/', r == ' ', r == '_':
			b.WriteRune('-')
		}
	}
	short := b.String()
	if len(short) > 24 {
		short = short[:24]
	}
	if short == "" {
		short = "t"
	}
	return short + "-" + hash
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
