package e2e

import (
	"net/http"
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSPAFallback_HTMLRoutes(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	cases := []string{
		"/",
		"/dashboard",
		"/admin/users",
		"/auth/login",
		"/auth/verify-email?token=anything",
		"/some/deep/unknown/path",
	}

	for _, path := range cases {
		t.Run("GET "+path, func(t *testing.T) {
			TagTest(t, "GET", "/*", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method:  http.MethodGet,
				Path:    path,
				Headers: map[string]string{"Accept": "text/html"},
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode, "path %q should render SPA shell", path)
			assert.Contains(t, resp.Header.Get("Content-Type"), "text/html")
			body := resp.GetString()
			assert.Contains(t, body, `<div id="app"></div>`, "body should contain SPA mount node")
			assert.Contains(t, body, "/resources/js/app.tsx", "body should reference the SPA entry script (dev mode in tests)")
		})
	}
}

func TestSPAFallback_RejectsAPIPaths(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	cases := []string{
		"/api/v1/unknown",
		"/build/missing.js",
		"/ws/api/unknown",
		"/openapi.unknown",
		"/docs",
	}

	for _, path := range cases {
		t.Run("GET "+path, func(t *testing.T) {
			TagTest(t, "GET", "/*", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
			resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
				Method:  http.MethodGet,
				Path:    path,
				Headers: map[string]string{"Accept": "text/html"},
			})
			require.NoError(t, err)
			body := resp.GetString()
			assert.NotContains(t, body, `<div id="app"></div>`,
				"path %q must not render SPA shell (reserved namespace)", path)
		})
	}
}

func TestSPAFallback_NonHTMLAcceptRejected(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    "/dashboard",
		Headers: map[string]string{"Accept": "application/json"},
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "application/json",
		"JSON-accepting clients should get the JSON error envelope, not HTML")
	body := resp.GetString()
	assert.False(t, strings.Contains(body, `<div id="app">`),
		"non-HTML accept should not get the SPA shell")
}
