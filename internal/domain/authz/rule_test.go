package authz

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func newParamCtx(t *testing.T, names, values []string) echo.Context {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames(names...)
	c.SetParamValues(values...)
	return c
}

func resolve(t *testing.T, r Rule, c echo.Context) []Requirement {
	t.Helper()
	reqs, err := r.resolve(c)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	return reqs
}

func TestPublic_flags(t *testing.T) {
	r := Public()
	if !r.public {
		t.Fatal("public flag not set")
	}
	if r.denyAPIKey {
		t.Fatal("denyAPIKey unexpectedly set")
	}
	if r.listScope {
		t.Fatal("listScope unexpectedly set")
	}
}

func TestPublic_resolves(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, Public(), c)
	if len(reqs) != 0 {
		t.Fatalf("Public: want 0 requirements, got %d", len(reqs))
	}
}

func TestAPIKeyDenied_flags(t *testing.T) {
	r := APIKeyDenied()
	if !r.denyAPIKey {
		t.Fatal("denyAPIKey flag not set")
	}
}

func TestAPIKeyDenied_resolves(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, APIKeyDenied(), c)
	if len(reqs) != 1 || reqs[0].Kind != KindAuthenticated {
		t.Fatalf("APIKeyDenied: want [KindAuthenticated], got %v", reqs)
	}
}

func TestAuthenticated_resolves(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, Authenticated(), c)
	if len(reqs) != 1 || reqs[0].Kind != KindAuthenticated {
		t.Fatalf("Authenticated: want [KindAuthenticated], got %v", reqs)
	}
}

func TestListScoped_flags(t *testing.T) {
	r := ListScoped()
	if !r.listScope {
		t.Fatal("listScope flag not set")
	}
}

func TestListScoped_resolves(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, ListScoped(), c)
	if len(reqs) != 1 || reqs[0].Kind != KindAuthenticated {
		t.Fatalf("ListScoped: want [KindAuthenticated], got %v", reqs)
	}
}

func TestStack_resolves(t *testing.T) {
	c := newParamCtx(t, []string{"serverid", "stackname"}, []string{"42", "mystack"})
	reqs := resolve(t, Stack("stacks.deploy"), c)
	if len(reqs) != 1 {
		t.Fatalf("Stack: want 1 requirement, got %d", len(reqs))
	}
	r := reqs[0]
	if r.Kind != KindStack {
		t.Errorf("Kind: got %v, want KindStack", r.Kind)
	}
	if r.Permission != "stacks.deploy" {
		t.Errorf("Permission: got %q, want %q", r.Permission, "stacks.deploy")
	}
	if r.ServerID != 42 {
		t.Errorf("ServerID: got %d, want 42", r.ServerID)
	}
	if r.Stack != "mystack" {
		t.Errorf("Stack: got %q, want %q", r.Stack, "mystack")
	}
}

func TestStack_badServerID_returnsError(t *testing.T) {
	c := newParamCtx(t, []string{"serverid", "stackname"}, []string{"notanumber", "mystack"})
	_, err := Stack("stacks.deploy").resolve(c)
	if err == nil {
		t.Fatal("expected error for bad serverid, got nil")
	}
}

func TestStack_missingStackName_returnsError(t *testing.T) {
	c := newParamCtx(t, []string{"serverid"}, []string{"42"})
	_, err := Stack("stacks.deploy").resolve(c)
	if err == nil {
		t.Fatal("expected error for missing stackname, got nil")
	}
}

func TestServer_resolves(t *testing.T) {
	c := newParamCtx(t, []string{"serverid"}, []string{"7"})
	reqs := resolve(t, Server("servers.read"), c)
	if len(reqs) != 1 {
		t.Fatalf("Server: want 1 requirement, got %d", len(reqs))
	}
	r := reqs[0]
	if r.Kind != KindServer {
		t.Errorf("Kind: got %v, want KindServer", r.Kind)
	}
	if r.Permission != "servers.read" {
		t.Errorf("Permission: got %q, want %q", r.Permission, "servers.read")
	}
	if r.ServerID != 7 {
		t.Errorf("ServerID: got %d, want 7", r.ServerID)
	}
}

func TestServer_badServerID_returnsError(t *testing.T) {
	c := newParamCtx(t, []string{"serverid"}, []string{"nope"})
	_, err := Server("servers.read").resolve(c)
	if err == nil {
		t.Fatal("expected error for bad serverid, got nil")
	}
}

func TestServerAccess_resolves(t *testing.T) {
	c := newParamCtx(t, []string{"serverid"}, []string{"3"})
	reqs := resolve(t, ServerAccess(), c)
	if len(reqs) != 1 {
		t.Fatalf("ServerAccess: want 1 requirement, got %d", len(reqs))
	}
	r := reqs[0]
	if r.Kind != KindServerAccess {
		t.Errorf("Kind: got %v, want KindServerAccess", r.Kind)
	}
	if r.ServerID != 3 {
		t.Errorf("ServerID: got %d, want 3", r.ServerID)
	}
}

func TestAdmin_resolves(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, Admin("admin.read"), c)
	if len(reqs) != 1 {
		t.Fatalf("Admin: want 1 requirement, got %d", len(reqs))
	}
	r := reqs[0]
	if r.Kind != KindAdmin {
		t.Errorf("Kind: got %v, want KindAdmin", r.Kind)
	}
	if r.Permission != "admin.read" {
		t.Errorf("Permission: got %q, want %q", r.Permission, "admin.read")
	}
}

func TestResolved_usesProvidedFn(t *testing.T) {
	want := []Requirement{{Kind: KindAuthenticated}, {Kind: KindAdmin, Permission: "x"}}
	r := Resolved(func(_ echo.Context) ([]Requirement, error) { return want, nil })
	c := newParamCtx(t, nil, nil)
	got := resolve(t, r, c)
	if len(got) != len(want) {
		t.Fatalf("Resolved: want %d requirements, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("Resolved[%d]: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestWithParams_overridesServerParam(t *testing.T) {
	c := newParamCtx(t, []string{"sid"}, []string{"99"})
	reqs := resolve(t, ServerAccess().WithParams("sid"), c)
	if len(reqs) != 1 || reqs[0].ServerID != 99 {
		t.Fatalf("WithParams: want ServerID=99, got %v", reqs)
	}
}

func TestWithParams_overridesStackParams(t *testing.T) {
	c := newParamCtx(t, []string{"svr", "stk"}, []string{"11", "altstack"})
	reqs := resolve(t, Stack("stacks.deploy").WithParams("svr", "stk"), c)
	if len(reqs) != 1 {
		t.Fatalf("WithParams stack: want 1 requirement, got %d", len(reqs))
	}
	if reqs[0].ServerID != 11 || reqs[0].Stack != "altstack" {
		t.Fatalf("WithParams stack: got %+v", reqs[0])
	}
}

func TestWithParams_defaultParamNoLongerWorkAfterOverride(t *testing.T) {
	c := newParamCtx(t, []string{"serverid"}, []string{"5"})
	_, err := ServerAccess().WithParams("sid").resolve(c)
	if err == nil {
		t.Fatal("expected error when default param name is absent after WithParams override, got nil")
	}
}

func TestRequireAPIKeyScope_appendsScopeRequirement(t *testing.T) {
	c := newParamCtx(t, nil, nil)
	reqs := resolve(t, Authenticated().RequireAPIKeyScope("servers.read"), c)
	if len(reqs) != 2 {
		t.Fatalf("RequireAPIKeyScope: want 2 requirements, got %d", len(reqs))
	}
	if reqs[0].Kind != KindAuthenticated {
		t.Errorf("first requirement: got %v, want KindAuthenticated", reqs[0].Kind)
	}
	if reqs[1].Kind != KindAPIKeyScope || reqs[1].Permission != "servers.read" {
		t.Errorf("second requirement: got %v, want KindAPIKeyScope(servers.read)", reqs[1])
	}
}

func TestRequireAPIKeyScope_appendsToStackRequirement(t *testing.T) {
	c := newParamCtx(t, []string{"serverid", "stackname"}, []string{"1", "s"})
	reqs := resolve(t, Stack("stacks.deploy").RequireAPIKeyScope("logs.operations.read"), c)
	if len(reqs) != 2 {
		t.Fatalf("RequireAPIKeyScope on Stack: want 2 requirements, got %d", len(reqs))
	}
	if reqs[1].Kind != KindAPIKeyScope || reqs[1].Permission != "logs.operations.read" {
		t.Errorf("appended requirement: got %v", reqs[1])
	}
}
