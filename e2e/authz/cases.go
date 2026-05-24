package authz

import (
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/require"
)

type RouteCall struct {
	Method string
	Path   string
	Body   any
}

type AgentNotCalled struct {
	Agent        *e2e.MockAgent
	Method       string
	PathContains string
}

type DBStateUnchanged struct {
	Description string
	Counter     func() int
}

type Case struct {
	Description string
	AuthHeader  string
	WantStatus  int
	NoAgent     *AgentNotCalled
	NoDB        *DBStateUnchanged
}

func RunCases(t *testing.T, app *e2e.TestApp, call RouteCall, cases []Case) {
	t.Helper()

	for _, c := range cases {
		t.Run(normalizeSubtestName(c.Description), func(t *testing.T) {
			t.Helper()

			var agentSnapshot int
			if c.NoAgent != nil {
				require.NotNil(t, c.NoAgent.Agent, "NoAgent.Agent must be set")
				agentSnapshot = len(c.NoAgent.Agent.Calls())
			}

			var dbSnapshot int
			if c.NoDB != nil {
				require.NotNil(t, c.NoDB.Counter, "NoDB.Counter must be set")
				dbSnapshot = c.NoDB.Counter()
			}

			opts := &e2etesting.RequestOptions{
				Method: call.Method,
				Path:   call.Path,
				Body:   call.Body,
			}
			if c.AuthHeader != "" {
				opts.Headers = map[string]string{"Authorization": c.AuthHeader}
			}

			resp, err := app.HTTPClient.Request(opts)
			require.NoError(t, err, "request: %s %s", call.Method, call.Path)
			require.Equal(t, c.WantStatus, resp.StatusCode, "status mismatch (body=%s)", resp.GetString())

			if c.NoAgent != nil {
				newCalls := c.NoAgent.Agent.Calls()[agentSnapshot:]
				for _, ac := range newCalls {
					if c.NoAgent.Method != "" && ac.Method != c.NoAgent.Method {
						continue
					}
					if c.NoAgent.PathContains != "" && !contains(ac.Path, c.NoAgent.PathContains) {
						continue
					}
					t.Fatalf("expected no agent call matching method=%q path~=%q after request, got %+v",
						c.NoAgent.Method, c.NoAgent.PathContains, ac)
				}
			}

			if c.NoDB != nil {
				after := c.NoDB.Counter()
				if after != dbSnapshot {
					t.Fatalf("expected DB state unchanged (%s) but counter went %d → %d",
						c.NoDB.Description, dbSnapshot, after)
				}
			}
		})
	}
}

func Unauthenticated(wantStatus int, opts ...CaseOption) Case {
	return applyCaseOptions(Case{
		Description: "unauthenticated",
		AuthHeader:  "",
		WantStatus:  wantStatus,
	}, opts)
}

func JWTRoleInPattern(jwt string, wantStatus int, opts ...CaseOption) Case {
	return jwtCase("jwt_role_in_pattern", jwt, wantStatus, opts)
}

func JWTRoleOutOfPattern(jwt string, wantStatus int, opts ...CaseOption) Case {
	return jwtCase("jwt_role_out_of_pattern", jwt, wantStatus, opts)
}

func JWTMultiRole(jwt string, wantStatus int, opts ...CaseOption) Case {
	return jwtCase("jwt_multi_role_union", jwt, wantStatus, opts)
}

func JWTAdmin(jwt string, wantStatus int, opts ...CaseOption) Case {
	return jwtCase("jwt_admin", jwt, wantStatus, opts)
}

func APIKeyNoScopeOnResource(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_no_scope_on_resource", plainKey, wantStatus, opts)
}

func APIKeyScopeEqualsRole(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_scope_equals_role", plainKey, wantStatus, opts)
}

func APIKeyScopeNarrower(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_scope_narrower_than_role", plainKey, wantStatus, opts)
}

func APIKeyScopeWrongServer(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_scope_wrong_server", plainKey, wantStatus, opts)
}

func APIKeyScopeWrongPermission(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_scope_wrong_permission", plainKey, wantStatus, opts)
}

func APIKeyAdminNoAdminScope(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_admin_no_admin_scope", plainKey, wantStatus, opts)
}

func APIKeyAdminMatchingScope(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_admin_matching_scope", plainKey, wantStatus, opts)
}

func APIKeyDoubleScopeCeiling(plainKey string, wantStatus int, opts ...CaseOption) Case {
	return keyCase("apikey_double_scope_ceiling", plainKey, wantStatus, opts)
}

type CaseOption func(*Case)

func WithNoAgent(a *AgentNotCalled) CaseOption {
	return func(c *Case) { c.NoAgent = a }
}

func WithNoDB(d *DBStateUnchanged) CaseOption {
	return func(c *Case) { c.NoDB = d }
}

func WithDescription(desc string) CaseOption {
	return func(c *Case) { c.Description = desc }
}

func jwtCase(desc, jwt string, wantStatus int, opts []CaseOption) Case {
	return applyCaseOptions(Case{
		Description: desc,
		AuthHeader:  "Bearer " + jwt,
		WantStatus:  wantStatus,
	}, opts)
}

func keyCase(desc, plainKey string, wantStatus int, opts []CaseOption) Case {
	return applyCaseOptions(Case{
		Description: desc,
		AuthHeader:  "Bearer " + plainKey,
		WantStatus:  wantStatus,
	}, opts)
}

func applyCaseOptions(c Case, opts []CaseOption) Case {
	for _, opt := range opts {
		opt(&c)
	}
	return c
}

func normalizeSubtestName(s string) string {
	if s == "" {
		return "case"
	}
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= '0' && c <= '9':
			out = append(out, c)
		case c >= 'A' && c <= 'Z':
			out = append(out, c+('a'-'A'))
		case c == ' ', c == '-', c == '/', c == ':':
			out = append(out, '_')
		}
	}
	if len(out) == 0 {
		return "case"
	}
	return string(out)
}

func contains(s, sub string) bool {
	if sub == "" {
		return true
	}
	n := len(s) - len(sub)
	for i := 0; i <= n; i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
