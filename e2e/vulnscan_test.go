package e2e

import (
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVulnscanStartScanRejectsMalformedBody(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	token := jwtLogin(t, app, "vulnscanmalformed", "vulnscanmalformed@example.com", "password123", true)

	TagTest(t, "POST", "/api/v1/servers/:serverid/stacks/:stackname/vulnscan", e2etesting.CategoryValidation, e2etesting.ValueMedium)

	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "POST",
		Path:    "/api/v1/servers/1/stacks/any-stack/vulnscan",
		RawBody: []byte(`{"services": [`),
		Headers: map[string]string{
			"Authorization": "Bearer " + token,
			"Content-Type":  "application/json",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, 400, resp.StatusCode, "malformed JSON body should be rejected, got: %s", resp.GetString())
}
