package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type Snapshot struct {
	Method     string            `json:"method"`
	Path       string            `json:"path"`
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       json.RawMessage   `json:"body"`
}

type SnapshotRecorder struct {
	dir    string
	update bool
}

func NewSnapshotRecorder(dir string, update bool) *SnapshotRecorder {
	return &SnapshotRecorder{dir: dir, update: update}
}

func snapshotFileName(method, path string) string {
	sanitized := path
	sanitized = strings.TrimPrefix(sanitized, "/")
	sanitized = strings.ReplaceAll(sanitized, "/", "_")
	sanitized = strings.ReplaceAll(sanitized, ":", "_")
	for strings.Contains(sanitized, "__") {
		sanitized = strings.ReplaceAll(sanitized, "__", "_")
	}
	sanitized = strings.Trim(sanitized, "_")
	return fmt.Sprintf("%s_%s.json", method, sanitized)
}

func Record(method, path string, resp *Response) *Snapshot {
	snap := &Snapshot{
		Method:     method,
		Path:       path,
		StatusCode: resp.StatusCode,
		Headers:    snapshotHeaders(resp),
	}

	contentType := resp.Header.Get("Content-Type")
	bodyStr := string(resp.Body)

	switch {
	case strings.Contains(contentType, "application/json"):
		var raw json.RawMessage
		if err := json.Unmarshal(resp.Body, &raw); err == nil {
			snap.Body = sanitizeJSON(raw)
		} else {
			snap.Body = jsonString(bodyStr)
		}

	case isInertiaHTML(bodyStr):
		if props := extractDataPageProps(bodyStr); props != nil {
			snap.Body = sanitizeJSON(props)
		} else {
			snap.Body = jsonString("[inertia html — props extraction failed]")
		}

	case resp.StatusCode >= 300 && resp.StatusCode < 400:
		snap.Body = jsonString(bodyStr)

	default:
		if len(bodyStr) > 4096 {
			bodyStr = bodyStr[:4096] + "...[truncated]"
		}
		snap.Body = jsonString(bodyStr)
	}

	return snap
}

var interestingHeaders = []string{
	"Content-Type",
	"Location",
	"X-Inertia",
	"X-Inertia-Location",
}

func snapshotHeaders(resp *Response) map[string]string {
	out := make(map[string]string)
	for _, h := range interestingHeaders {
		if v := resp.Header.Get(h); v != "" {
			out[h] = v
		}
	}
	return out
}

func (sr *SnapshotRecorder) AssertMatch(t *testing.T, snap *Snapshot) {
	t.Helper()

	filename := snapshotFileName(snap.Method, snap.Path)
	fullPath := filepath.Join(sr.dir, filename)

	got, err := json.MarshalIndent(snap, "", "  ")
	require.NoError(t, err, "failed to marshal snapshot")

	if sr.update {
		err := os.MkdirAll(sr.dir, 0o755)
		require.NoError(t, err, "failed to create snapshot directory")
		err = os.WriteFile(fullPath, append(got, '\n'), 0o644)
		require.NoError(t, err, "failed to write snapshot %s", filename)
		t.Logf("snapshot updated: %s", filename)
		return
	}

	expected, err := os.ReadFile(fullPath)
	if os.IsNotExist(err) {
		t.Fatalf("snapshot file missing: %s\nRun with -update to create it.\nGot:\n%s", filename, got)
	}
	require.NoError(t, err, "failed to read snapshot %s", filename)

	gotStr := strings.TrimSpace(string(got))
	expectedStr := strings.TrimSpace(string(expected))

	if gotStr != expectedStr {
		assert.JSONEq(t, expectedStr, gotStr,
			"snapshot mismatch for %s %s (%s)\nRun with -update to regenerate.",
			snap.Method, snap.Path, filename)
	}
}

func (sr *SnapshotRecorder) RecordAndAssert(t *testing.T, method, path string, resp *Response) {
	t.Helper()
	snap := Record(method, path, resp)
	sr.AssertMatch(t, snap)
}

var inertiaPageScriptRe = regexp.MustCompile(`(?s)<script[^>]*data-page="[^"]*"[^>]*type="application/json"[^>]*>(.*?)</script>`)

func isInertiaHTML(body string) bool {
	return strings.Contains(body, "data-page=")
}

func ExtractInertiaPageJSON(body []byte) []byte {
	m := inertiaPageScriptRe.FindSubmatch(body)
	if m == nil {
		return nil
	}
	return []byte(strings.ReplaceAll(string(m[1]), `<\/script>`, `</script>`))
}

func extractDataPageProps(body string) json.RawMessage {
	raw := ExtractInertiaPageJSON([]byte(body))
	if raw == nil {
		return nil
	}

	var page struct {
		Component string          `json:"component"`
		Props     json.RawMessage `json:"props"`
		URL       string          `json:"url"`
		Version   string          `json:"version"`
	}
	if err := json.Unmarshal(raw, &page); err != nil {
		return nil
	}

	wrapper := map[string]interface{}{
		"component": page.Component,
		"url":       page.URL,
	}

	var propsMap map[string]interface{}
	if err := json.Unmarshal(page.Props, &propsMap); err == nil {
		wrapper["props"] = sanitizeMap(propsMap)
	} else {
		wrapper["props"] = page.Props
	}

	out, _ := json.Marshal(wrapper)
	return out
}

var volatileFieldPatterns = []string{
	"_at",     // created_at, updated_at, deleted_at, email_verified_at, etc.
	"_token",  // access_token, refresh_token, csrf_token, etc.
	"token",   // bare "token" field
	"secret",  // totp secret, etc.
	"expires", // token expiry timestamps
}

var volatileFieldExact = map[string]bool{
	"id":           true,
	"ID":           true,
	"user_id":      true,
	"userID":       true,
	"role_id":      true,
	"csrfToken":    true,
	"expires_at":   true,
	"expiry":       true,
	"password":     true,
	"port":         true,
	"last_used":    true,
	"qr_code_uri":  true,
	"key_prefix":   true,
	"plain_key":    true,
	"access_token": true,
	"jti":          true,
}

func isVolatileField(key string) bool {
	if volatileFieldExact[key] {
		return true
	}
	lower := strings.ToLower(key)
	for _, pat := range volatileFieldPatterns {
		if strings.HasSuffix(lower, pat) {
			return true
		}
	}
	return false
}
func placeholder(key string, val interface{}) interface{} {
	lower := strings.ToLower(key)
	switch {
	case strings.HasSuffix(lower, "_at") || lower == "expires_at" || lower == "expiry" || lower == "expires" || lower == "last_used":
		return "<<TIMESTAMP>>"
	case strings.Contains(lower, "token") || lower == "secret" || lower == "jti":
		return "<<TOKEN>>"
	case lower == "id" || strings.HasSuffix(lower, "_id") || strings.HasSuffix(lower, "id"):
		switch v := val.(type) {
		case float64:
			if v == 0 {
				return float64(0)
			}
			return "<<ID>>"
		case nil:
			return nil
		}
		return "<<ID>>"
	case lower == "password":
		return "<<REDACTED>>"
	case lower == "port":
		return "<<PORT>>"
	case lower == "qr_code_uri":
		return "<<QR_CODE_URI>>"
	case lower == "key_prefix" || lower == "plain_key":
		return "<<KEY>>"
	default:
		return "<<SANITIZED>>"
	}
}

func sanitizeJSON(raw json.RawMessage) json.RawMessage {
	var val interface{}
	if err := json.Unmarshal(raw, &val); err != nil {
		return raw
	}
	sanitized := sanitizeValue("", val)
	out, _ := json.Marshal(sanitized)
	return out
}

func sanitizeValue(key string, val interface{}) interface{} {
	switch v := val.(type) {
	case map[string]interface{}:
		return sanitizeMap(v)
	case []interface{}:
		return sanitizeSlice(v)
	default:
		if key != "" && isVolatileField(key) {
			return placeholder(key, val)
		}
		return val
	}
}

func sanitizeMap(m map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		if isVolatileField(k) {
			out[k] = placeholder(k, v)
		} else {
			out[k] = sanitizeValue(k, v)
		}
	}
	return out
}

func sanitizeSlice(s []interface{}) []interface{} {
	out := make([]interface{}, len(s))
	for i, v := range s {
		out[i] = sanitizeValue("", v)
	}
	return out
}

func jsonString(s string) json.RawMessage {
	b, _ := json.Marshal(s)
	return b
}
