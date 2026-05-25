package authz

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/rbac/permnames"

	"github.com/stretchr/testify/require"
)

func registerFilesEndpoints(agent *e2e.MockAgent, stackName string) {
	base := "/api/stacks/" + stackName + "/files"
	agent.RegisterJSONHandler(base, map[string]any{
		"path":    ".",
		"entries": []any{},
	})
	agent.RegisterJSONHandler(base+"/read", map[string]any{
		"path":    "test.txt",
		"content": "hello",
	})
	agent.RegisterHandler(base+"/download", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write([]byte("file contents"))
	})
	agent.RegisterJSONHandler(base+"/stats", map[string]any{
		"path":         ".",
		"total_size":   0,
		"file_count":   0,
		"dir_count":    0,
		"largest_file": "",
		"max_depth":    0,
	})
	agent.RegisterJSONHandler(base+"/write", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/upload", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/mkdir", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/delete", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/rename", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/copy", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/chmod", map[string]string{"message": "success"})
	agent.RegisterJSONHandler(base+"/chown", map[string]string{"message": "success"})
}

func TestAuthzFilesRead(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerFilesEndpoints(f.Agent, "prod-web")
	registerFilesEndpoints(f.Agent, "staging-web")
	registerFilesEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/files"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/files"

	_, jwtRead, _ := f.UserWithRole("read", f.Server, permnames.FilesRead, "prod-*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("read-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesRead, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesRead, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.FilesRead, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.FilesRead, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.FilesRead, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesRead, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesRead, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.FilesRead, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.FilesRead, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.FilesRead, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, "", 401)
	})
	t.Run("JWT with files.read on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtRead), 200)
	})
	t.Run("JWT with files.read out-of-pattern returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtRead), 403)
	})
	t.Run("JWT stacks.read only returns 403 (no files.read)", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtStacksOnly), 403)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/files"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: opsURL}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtUnion), 403)
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope on resource returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNoScope), 403)
	})
	t.Run("API key with scope equal to role pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyNarrower), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: stagingURL}, bearer(keyNarrower), 403)
	})
	t.Run("API key scoped to wrong server returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongServer), 403)
	})
	t.Run("API key with wrong permission scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyWrongPerm), 403)
	})
	t.Run("API key (admin owner) without matching scope returns 403", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(keyAdminNoScope), 403)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.FilesRead, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.FilesRead, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prodURL}, bearer(key), 403)
	})
}

func TestAuthzFilesReadSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerFilesEndpoints(f.Agent, "prod-web")
	registerFilesEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.FilesRead, "prod-*")

	siblings := []struct {
		name  string
		query string
	}{
		{"read", "?filePath=test.txt"},
		{"download", "?filePath=test.txt"},
		{"stats", ""},
	}
	for _, sib := range siblings {
		t.Run(sib.name, func(t *testing.T) {
			prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/" + sib.name + sib.query
			staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/" + sib.name + sib.query

			t.Run("unauthenticated returns 401", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prod}, "", 401)
			})
			t.Run("JWT in-pattern is admitted", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: prod}, bearer(jwt), 200)
			})
			t.Run("JWT out-of-pattern returns 403", func(t *testing.T) {
				assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodGet, Path: staging}, bearer(jwt), 403)
			})
		})
	}
}

func TestAuthzFilesWrite(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerFilesEndpoints(f.Agent, "prod-web")
	registerFilesEndpoints(f.Agent, "staging-web")
	registerFilesEndpoints(f.Agent, "ops-db")

	sid := e2e.Itoa(f.Server.ID)
	prodURL := "/api/v1/servers/" + sid + "/stacks/prod-web/files/write"
	stagingURL := "/api/v1/servers/" + sid + "/stacks/staging-web/files/write"

	body := map[string]any{"path": "test.txt", "content": "hello"}

	assertNoWrite := func(t *testing.T) {
		t.Helper()
		f.Agent.AssertNotCalled(t, http.MethodPost, "/files/write")
	}

	_, jwtWrite, _ := f.UserWithRole("write", f.Server, permnames.FilesWrite, "prod-*")
	_, jwtRead, _ := f.UserWithRole("read-only", f.Server, permnames.FilesRead, "prod-*")
	_, jwtStacksOnly, _ := f.UserWithRole("stacks-only", f.Server, permnames.StacksRead, "prod-*")
	_, jwtAdmin := f.Admin("write-admin")
	_, jwtUnion := f.UserWithRoles("union", []RoleSpec{
		{Name: "ra", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "prod-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "prod-*"},
		}},
		{Name: "rb", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "ops-*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "ops-*"},
		}},
	})

	noScopeOwner, _, _ := f.UserWithRole("noscope-owner", f.Server, permnames.FilesWrite, "*")
	keyNoScope := f.APIKeyFor(noScopeOwner, "noscope-key", nil)

	matchingOwner, _, _ := f.UserWithRole("matching-owner", f.Server, permnames.FilesWrite, "prod-*")
	keyMatching := f.APIKeyFor(matchingOwner, "matching-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesWrite, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	narrowerOwner, _, _ := f.UserWithRole("narrower-owner", f.Server, permnames.FilesWrite, "*")
	keyNarrower := f.APIKeyFor(narrowerOwner, "narrower-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.FilesWrite, "prod-*"),
		keyScope(&f.Server.ID, permnames.StacksRead, "prod-*"),
	})

	otherServer, _ := f.AddServer("other-srv")
	wrongSrvOwner, _ := f.UserWithRoles("wrong-server-owner", []RoleSpec{
		{Name: "rl", Grants: []RoleGrant{
			{Server: f.Server, Permission: permnames.FilesWrite, StackPattern: "*"},
			{Server: f.Server, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
		{Name: "rr", Grants: []RoleGrant{
			{Server: otherServer, Permission: permnames.FilesWrite, StackPattern: "*"},
			{Server: otherServer, Permission: permnames.StacksRead, StackPattern: "*"},
		}},
	})
	keyWrongServer := f.APIKeyFor(wrongSrvOwner, "wrong-server-key", []ScopeSpec{
		keyScope(&otherServer.ID, permnames.FilesWrite, "*"),
		keyScope(&otherServer.ID, permnames.StacksRead, "*"),
	})

	wrongPermOwner, _, _ := f.UserWithRole("wrongperm-owner", f.Server, permnames.FilesWrite, "*")
	keyWrongPerm := f.APIKeyFor(wrongPermOwner, "wrongperm-key", []ScopeSpec{
		keyScope(&f.Server.ID, permnames.StacksRead, "*"),
	})

	adminOwner, _ := f.Admin("admin-noscope-owner")
	keyAdminNoScope := f.APIKeyFor(adminOwner, "admin-noscope-key", nil)

	t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, "", 401)
		assertNoWrite(t)
	})
	t.Run("JWT with files.write on in-pattern is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtWrite), 200)
	})
	t.Run("JWT with files.write out-of-pattern returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtWrite), 403)
		assertNoWrite(t)
	})
	t.Run("JWT files.read only returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtRead), 403)
		assertNoWrite(t)
	})
	t.Run("JWT stacks.read only returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtStacksOnly), 403)
		assertNoWrite(t)
	})
	t.Run("JWT with multi-role union admits each unioned pattern", func(t *testing.T) {
		opsURL := "/api/v1/servers/" + sid + "/stacks/ops-db/files/write"
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtUnion), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: opsURL, Body: body}, bearer(jwtUnion), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtUnion), 403)
		assertNoWrite(t)
	})
	t.Run("JWT admin is admitted on any stack", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(jwtAdmin), 200)
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(jwtAdmin), 200)
	})
	t.Run("API key with no scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNoScope), 403)
		assertNoWrite(t)
	})
	t.Run("API key with files.write+stacks.read scopes is admitted", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyMatching), 200)
	})
	t.Run("API key narrower than role admits in-pattern, denies out-of-pattern", func(t *testing.T) {
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyNarrower), 200)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: stagingURL, Body: body}, bearer(keyNarrower), 403)
		assertNoWrite(t)
	})
	t.Run("API key scoped to wrong server returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongServer), 403)
		assertNoWrite(t)
	})
	t.Run("API key with wrong permission scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyWrongPerm), 403)
		assertNoWrite(t)
	})
	t.Run("API key (admin owner) without matching scope returns 403 with no agent call", func(t *testing.T) {
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(keyAdminNoScope), 403)
		assertNoWrite(t)
	})
	t.Run("API key fails after owner loses the role that granted it", func(t *testing.T) {
		owner, _, roleName := f.UserWithRole("revoked-owner", f.Server, permnames.FilesWrite, "*")
		key := f.APIKeyFor(owner, "revoked-key", []ScopeSpec{
			keyScope(&f.Server.ID, permnames.FilesWrite, "*"),
			keyScope(&f.Server.ID, permnames.StacksRead, "*"),
		})
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 200)
		f.RevokeRole(owner, roleName)
		f.Agent.ResetCalls()
		assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prodURL, Body: body}, bearer(key), 403)
		assertNoWrite(t)
	})
}

func TestAuthzFilesWriteSiblings(t *testing.T) {
	t.Parallel()
	app := e2e.SetupTestApp(t)
	f := NewAuthzFixture(t, app)
	registerFilesEndpoints(f.Agent, "prod-web")
	registerFilesEndpoints(f.Agent, "staging-web")

	sid := e2e.Itoa(f.Server.ID)
	_, jwt, _ := f.UserWithRole("sib", f.Server, permnames.FilesWrite, "prod-*")

	t.Run("upload", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/upload"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/upload"

		uploadOpts := func(t *testing.T, path string) *e2etesting.RequestOptions {
			var buf bytes.Buffer
			w := multipart.NewWriter(&buf)
			part, err := w.CreateFormFile("file", "x.txt")
			require.NoError(t, err)
			_, err = part.Write([]byte("hello"))
			require.NoError(t, err)
			require.NoError(t, w.WriteField("filePath", "."))
			require.NoError(t, w.Close())
			return &e2etesting.RequestOptions{
				Method:      http.MethodPost,
				Path:        path,
				RawBody:     buf.Bytes(),
				ContentType: w.FormDataContentType(),
			}
		}

		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, uploadOpts(t, prod), "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/upload")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, uploadOpts(t, prod), bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, uploadOpts(t, staging), bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/upload")
		})
	})

	t.Run("mkdir", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/mkdir"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/mkdir"
		body := map[string]any{"path": "newdir"}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/mkdir")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/mkdir")
		})
	})

	t.Run("delete", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/delete"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/delete"
		body := map[string]any{"path": "test.txt"}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodDelete, "/files/delete")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodDelete, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodDelete, "/files/delete")
		})
	})

	t.Run("rename", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/rename"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/rename"
		body := map[string]any{"old_path": "a.txt", "new_path": "b.txt"}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/rename")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/rename")
		})
	})

	t.Run("copy", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/copy"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/copy"
		body := map[string]any{"source_path": "a.txt", "target_path": "b.txt"}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/copy")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/copy")
		})
	})

	t.Run("chmod", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/chmod"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/chmod"
		body := map[string]any{"path": "test.txt", "mode": "0644"}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/chmod")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/chmod")
		})
	})

	t.Run("chown", func(t *testing.T) {
		prod := "/api/v1/servers/" + sid + "/stacks/prod-web/files/chown"
		staging := "/api/v1/servers/" + sid + "/stacks/staging-web/files/chown"
		body := map[string]any{"path": "test.txt", "owner_id": uint32(1000), "group_id": uint32(1000)}
		t.Run("unauthenticated returns 401 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, "", 401)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/chown")
		})
		t.Run("JWT in-pattern is admitted", func(t *testing.T) {
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: prod, Body: body}, bearer(jwt), 200)
		})
		t.Run("JWT out-of-pattern returns 403 with no agent call", func(t *testing.T) {
			f.Agent.ResetCalls()
			assertStatus(t, app, &e2etesting.RequestOptions{Method: http.MethodPost, Path: staging, Body: body}, bearer(jwt), 403)
			f.Agent.AssertNotCalled(t, http.MethodPost, "/files/chown")
		})
	})
}
