package e2e

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"berth/internal/domain/testsupport"
)

type MockAgent struct {
	*testsupport.MockAgent

	mu             sync.RWMutex
	forceError     bool
	forceErrorCode int
	forceErrorMsg  string

	callsMu sync.Mutex
	calls   []AgentCall
}

type AgentCall struct {
	Method string
	Path   string
}

func NewMockAgent() *MockAgent {
	ma := &MockAgent{MockAgent: testsupport.NewMockAgent()}
	ma.Intercept(ma.recordAndMaybeFail)
	return ma
}

func (ma *MockAgent) recordAndMaybeFail(w http.ResponseWriter, r *http.Request) bool {
	ma.callsMu.Lock()
	ma.calls = append(ma.calls, AgentCall{Method: r.Method, Path: r.URL.Path})
	ma.callsMu.Unlock()

	ma.mu.RLock()
	forceError, code, message := ma.forceError, ma.forceErrorCode, ma.forceErrorMsg
	ma.mu.RUnlock()

	if forceError {
		http.Error(w, message, code)
		return true
	}
	return false
}

func (ma *MockAgent) StreamFrames(w http.ResponseWriter, r *http.Request, payloads ...string) {
	frames, _, err := ma.Signer().StreamSession(r)
	if err != nil {
		http.Error(w, "no stream session", http.StatusInternalServerError)
		return
	}
	for _, payload := range payloads {
		fmt.Fprintf(w, "data: %s\n\n", base64.StdEncoding.EncodeToString(frames.Wrap([]byte(payload))))
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
	}
}

func (ma *MockAgent) SetError(code int, message string) {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.forceError = true
	ma.forceErrorCode = code
	ma.forceErrorMsg = message
}

func (ma *MockAgent) ClearError() {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.forceError = false
}

func (ma *MockAgent) Calls() []AgentCall {
	ma.callsMu.Lock()
	defer ma.callsMu.Unlock()
	out := make([]AgentCall, len(ma.calls))
	copy(out, ma.calls)
	return out
}

func (ma *MockAgent) CallsMatching(method, pathContains string) []AgentCall {
	ma.callsMu.Lock()
	defer ma.callsMu.Unlock()
	var out []AgentCall
	for _, c := range ma.calls {
		if method != "" && c.Method != method {
			continue
		}
		if pathContains != "" && !strings.Contains(c.Path, pathContains) {
			continue
		}
		out = append(out, c)
	}
	return out
}

func (ma *MockAgent) AssertNotCalled(t *testing.T, method, pathContains string) {
	t.Helper()
	matches := ma.CallsMatching(method, pathContains)
	if len(matches) > 0 {
		t.Fatalf("expected no agent calls matching method=%q path~=%q, got %d: %+v",
			method, pathContains, len(matches), matches)
	}
}

func (ma *MockAgent) ResetCalls() {
	ma.callsMu.Lock()
	defer ma.callsMu.Unlock()
	ma.calls = nil
}
