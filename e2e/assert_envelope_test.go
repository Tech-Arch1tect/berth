package e2e

import (
	"encoding/json"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func assertJSONEnvelope(t *testing.T, resp *e2etesting.Response, wantStatus int, wantErrorCode, wantMessage string) {
	t.Helper()
	require.Contains(t, resp.Header.Get("Content-Type"), "application/json")
	assert.Equal(t, wantStatus, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.Unmarshal(resp.Body, &body))

	success, ok := body["success"].(bool)
	require.True(t, ok, "success must be a bool: %v", body)
	assert.False(t, success, "success must be false on error")

	data, ok := body["data"].(map[string]any)
	require.True(t, ok, "data must be an object: %v", body)
	assert.Empty(t, data, "data must be an empty object on error")

	errObj, ok := body["error"].(map[string]any)
	require.True(t, ok, "error must be an object: %v", body)

	codeStr, ok := errObj["code"].(string)
	require.True(t, ok, "error.code must be a string: %v", errObj)
	assert.Equal(t, wantErrorCode, codeStr)

	messageStr, ok := errObj["message"].(string)
	require.True(t, ok, "error.message must be a string: %v", errObj)
	assert.Equal(t, wantMessage, messageStr)
}
