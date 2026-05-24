package e2e

import (
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

type MockAgent struct {
	Server *httptest.Server
	URL    string

	mu       sync.RWMutex
	handlers map[string]http.HandlerFunc

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
	ma := &MockAgent{
		handlers: make(map[string]http.HandlerFunc),
	}

	ma.handlers["/health"] = func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", ma.dispatch)

	ma.Server = httptest.NewTLSServer(mux)
	ma.URL = ma.Server.URL

	return ma
}

func (ma *MockAgent) dispatch(w http.ResponseWriter, r *http.Request) {
	ma.callsMu.Lock()
	ma.calls = append(ma.calls, AgentCall{Method: r.Method, Path: r.URL.Path})
	ma.callsMu.Unlock()

	ma.mu.RLock()
	if ma.forceError {
		code := ma.forceErrorCode
		msg := ma.forceErrorMsg
		ma.mu.RUnlock()
		http.Error(w, msg, code)
		return
	}

	handler, exists := ma.handlers[r.URL.Path]
	ma.mu.RUnlock()

	if exists {
		handler(w, r)
		return
	}

	http.Error(w, "not found", http.StatusNotFound)
}

func (ma *MockAgent) Close() {
	if ma.Server != nil {
		ma.Server.Close()
	}
}

func (ma *MockAgent) GetHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
	}
}

func (ma *MockAgent) RegisterHandler(path string, handler http.HandlerFunc) {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.handlers[path] = handler
}

func (ma *MockAgent) RegisterJSONHandler(path string, response any) {
	ma.RegisterHandler(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
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
