package e2e

import (
	"encoding/json"
	"net/http"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	csrfErrorMessage    = "missing csrf token in request header"
	csrfErrorStatusCode = http.StatusBadRequest
)

func triggerCSRFError(t *testing.T, app *TestApp, headers map[string]string) *e2etesting.Response {
	t.Helper()
	client := app.HTTPClient.WithoutRedirects()
	resp, err := client.Request(&e2etesting.RequestOptions{
		Method:  http.MethodDelete,
		Path:    "/auth/login",
		Headers: headers,
	})
	require.NoError(t, err)
	return resp
}

func triggerAPIAuthError(t *testing.T, app *TestApp, headers map[string]string) *e2etesting.Response {
	t.Helper()
	client := app.HTTPClient.WithoutRedirects()
	resp, err := client.Request(&e2etesting.RequestOptions{
		Method:  http.MethodGet,
		Path:    "/api/v1/this-endpoint-does-not-exist",
		Headers: headers,
	})
	require.NoError(t, err)
	return resp
}

func assertJSONEnvelope(t *testing.T, resp *e2etesting.Response, wantCode int, wantMessage string) {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "application/json")
	assert.Equal(t, wantCode, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.Unmarshal(resp.Body, &body))

	errStr, ok := body["error"].(string)
	require.True(t, ok, "error must be a string: %v", body)
	assert.Equal(t, wantMessage, errStr)

	codeNum, ok := body["code"].(float64)
	require.True(t, ok, "code must be a number: %v", body)
	assert.Equal(t, float64(wantCode), codeNum)

	assert.Len(t, body, 2)
}

func assertInertiaErrorHTML(t *testing.T, resp *e2etesting.Response, wantCode int, wantMessage string) {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "text/html")
	raw := e2etesting.ExtractInertiaPageJSON(resp.Body)
	require.NotNil(t, raw, "no inertia data-page in body: %s", resp.GetString())

	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal(raw, &page))

	assert.Equal(t, "Errors/Generic", page.Component)
	assert.Equal(t, float64(wantCode), page.Props["code"])
	assert.Equal(t, wantMessage, page.Props["message"])
}

func assertInertiaErrorJSON(t *testing.T, resp *e2etesting.Response, wantCode int, wantMessage string) {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "application/json")

	var page struct {
		Component string         `json:"component"`
		Props     map[string]any `json:"props"`
	}
	require.NoError(t, json.Unmarshal(resp.Body, &page))

	assert.Equal(t, "Errors/Generic", page.Component)
	assert.Equal(t, float64(wantCode), page.Props["code"])
	assert.Equal(t, wantMessage, page.Props["message"])
}

func TestHTTPErrorHandler_JSONBranch(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("CSRF rejection returns JSON envelope", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "application/json"})
		assertJSONEnvelope(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("API auth rejection returns JSON envelope", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/error-handler", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerAPIAuthError(t, app, map[string]string{"Accept": "application/json"})
		assertJSONEnvelope(t, resp, http.StatusUnauthorized, "Authentication required")
	})

	t.Run("Accept */* routes to JSON", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "*/*"})
		assertJSONEnvelope(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("Accept application/xml routes to JSON", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "application/xml"})
		assertJSONEnvelope(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("missing Accept routes to JSON", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerCSRFError(t, app, nil)
		assertJSONEnvelope(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("envelope has exactly error and code", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "application/json"})

		var body map[string]any
		require.NoError(t, json.Unmarshal(resp.Body, &body))

		assert.Contains(t, body, "error")
		assert.Contains(t, body, "code")
		assert.Len(t, body, 2)

		_, isString := body["error"].(string)
		_, isNumber := body["code"].(float64)
		assert.True(t, isString)
		assert.True(t, isNumber)
	})
}

func TestHTTPErrorHandler_HTMLBranch(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("Accept text/html renders Errors/Generic", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "text/html"})
		assertInertiaErrorHTML(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("Accept with text/html amongst other types routes to HTML", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerCSRFError(t, app, map[string]string{
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		})
		assertInertiaErrorHTML(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("HTML branch status is 200 with code in props", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "text/html"})

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		raw := e2etesting.ExtractInertiaPageJSON(resp.Body)
		require.NotNil(t, raw)
		var page struct {
			Props map[string]any `json:"props"`
		}
		require.NoError(t, json.Unmarshal(raw, &page))
		assert.Equal(t, float64(csrfErrorStatusCode), page.Props["code"])
	})
}

func TestHTTPErrorHandler_InertiaBranch(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("X-Inertia overrides Accept application/json", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{
			"Accept":    "application/json",
			"X-Inertia": "true",
		})
		assertInertiaErrorJSON(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})

	t.Run("X-Inertia with no Accept routes to Inertia", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerCSRFError(t, app, map[string]string{"X-Inertia": "true"})
		assertInertiaErrorJSON(t, resp, csrfErrorStatusCode, csrfErrorMessage)
	})
}

func TestHTTPErrorHandler_StatusPropagation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("400 from CSRF error", func(t *testing.T) {
		TagTest(t, "DELETE", "/auth/login", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerCSRFError(t, app, map[string]string{"Accept": "application/json"})
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("401 from API auth error", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/error-handler", e2etesting.CategoryErrorHandler, e2etesting.ValueHigh)
		resp := triggerAPIAuthError(t, app, map[string]string{"Accept": "application/json"})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("401 regardless of Accept value", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/error-handler", e2etesting.CategoryErrorHandler, e2etesting.ValueMedium)
		resp := triggerAPIAuthError(t, app, map[string]string{"Accept": "*/*"})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

		var body map[string]any
		require.NoError(t, json.Unmarshal(resp.Body, &body))
		assert.Equal(t, float64(http.StatusUnauthorized), body["code"])
	})
}
