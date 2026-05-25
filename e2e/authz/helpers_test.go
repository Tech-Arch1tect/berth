package authz

import (
	"testing"

	"berth/e2e"
	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func bearer(token string) string {
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

func assertStatus(t *testing.T, app *e2e.TestApp, opts *e2etesting.RequestOptions, authHeader string, want int) {
	t.Helper()
	if authHeader != "" {
		if opts.Headers == nil {
			opts.Headers = map[string]string{}
		}
		opts.Headers["Authorization"] = authHeader
	}
	resp, err := app.HTTPClient.Request(opts)
	require.NoError(t, err)
	assert.Equal(t, want, resp.StatusCode, "%s %s body=%s", opts.Method, opts.Path, resp.GetString())
}
