package e2e

import (
	"testing"

	"berth/internal/domain/security"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditAPIKeyValidationFailure(t *testing.T) {
	app := SetupTestApp(t)

	before := countAuditEvents(t, app.DB, security.EventAPIKeyValidationFailed)

	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "GET",
		Path:    "/api/v1/servers",
		Headers: map[string]string{"Authorization": "Bearer brth_this-is-not-a-real-key"},
	})
	require.NoError(t, err)
	assert.Equal(t, 401, resp.StatusCode, "an invalid API key must be rejected")

	after := countAuditEvents(t, app.DB, security.EventAPIKeyValidationFailed)
	assert.Equal(t, before+1, after, "the failed API-key validation must be audited exactly once")
}
