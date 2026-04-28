//go:build e2e

package testsupport

import (
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
)

type MockAgent struct {
	server *httptest.Server
	URL    string

	mu       sync.RWMutex
	handlers map[string]http.HandlerFunc
}

func NewMockAgent() *MockAgent {
	ma := &MockAgent{
		handlers: make(map[string]http.HandlerFunc),
	}

	ma.handlers["/health"] = func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", ma.dispatch)

	ma.server = httptest.NewTLSServer(mux)
	ma.URL = ma.server.URL

	return ma
}

func (ma *MockAgent) dispatch(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	if path == "" {
		path = "/"
	}

	ma.mu.RLock()
	handler, exists := ma.handlers[path]
	ma.mu.RUnlock()

	if exists {
		handler(w, r)
		return
	}

	http.Error(w, "not found", http.StatusNotFound)
}

func (ma *MockAgent) RegisterHandler(path string, handler http.HandlerFunc) {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.handlers[path] = handler
}

func (ma *MockAgent) RegisterJSON(path string, status int, body any) {
	ma.RegisterHandler(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	})
}

func (ma *MockAgent) ResetHandlers() {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.handlers = map[string]http.HandlerFunc{
		"/health": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		},
	}
}

func (ma *MockAgent) Close() {
	if ma.server != nil {
		ma.server.Close()
	}
}

func insecureClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
}
