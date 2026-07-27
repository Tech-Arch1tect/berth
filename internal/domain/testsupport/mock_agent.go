package testsupport

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
)

type MockAgent struct {
	server *httptest.Server
	URL    string

	mu             sync.RWMutex
	handlers       map[string]http.HandlerFunc
	responseSigner *AgentResponseSigner
	intercept      func(http.ResponseWriter, *http.Request) bool
}

func NewMockAgent() *MockAgent {
	ma := &MockAgent{handlers: defaultHandlers()}

	mux := http.NewServeMux()
	mux.HandleFunc("/", ma.dispatch)

	ma.server = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ma.mu.RLock()
		signer := ma.responseSigner
		ma.mu.RUnlock()
		if signer == nil {
			mux.ServeHTTP(w, r)
			return
		}
		signer.Wrap(mux).ServeHTTP(w, r)
	}))
	ma.server.StartTLS()
	ma.URL = ma.server.URL

	return ma
}

func defaultHandlers() map[string]http.HandlerFunc {
	return map[string]http.HandlerFunc{
		"/health": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		},
	}
}

func (ma *MockAgent) SignResponsesWith(signer *AgentResponseSigner) {
	ma.mu.Lock()
	ma.responseSigner = signer
	ma.mu.Unlock()
}

func (ma *MockAgent) Intercept(intercept func(http.ResponseWriter, *http.Request) bool) {
	ma.mu.Lock()
	ma.intercept = intercept
	ma.mu.Unlock()
}

func (ma *MockAgent) dispatch(w http.ResponseWriter, r *http.Request) {
	ma.mu.RLock()
	intercept := ma.intercept
	ma.mu.RUnlock()
	if intercept != nil && intercept(w, r) {
		return
	}

	if handler, exists := ma.handlerFor(r.URL.Path); exists {
		handler(w, r)
		return
	}

	http.Error(w, "not found", http.StatusNotFound)
}

func (ma *MockAgent) handlerFor(path string) (http.HandlerFunc, bool) {
	ma.mu.RLock()
	defer ma.mu.RUnlock()

	if handler, exists := ma.handlers[path]; exists {
		return handler, true
	}
	handler, exists := ma.handlers[strings.TrimPrefix(path, "/api")]
	return handler, exists
}

func (ma *MockAgent) RegisterHandler(path string, handler http.HandlerFunc) {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.handlers[path] = handler
}

func (ma *MockAgent) RegisterJSONHandler(path string, body any) {
	ma.RegisterJSON(path, http.StatusOK, body)
}

func (ma *MockAgent) RegisterJSON(path string, status int, body any) {
	ma.RegisterHandler(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	})
}

func (ma *MockAgent) RegisterRaw(path string, status int, contentType, body string) {
	ma.RegisterHandler(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		w.WriteHeader(status)
		if strings.HasPrefix(contentType, "text/event-stream") {
			ma.writeFramedEvents(w, r, body)
			return
		}
		_, _ = w.Write([]byte(body))
	})
}

func (ma *MockAgent) writeFramedEvents(w http.ResponseWriter, r *http.Request, body string) {
	frames, _, err := ma.Signer().StreamSession(r)
	if err != nil {
		return
	}
	for _, line := range strings.Split(body, "\n") {
		payload, isEvent := strings.CutPrefix(line, "data: ")
		if !isEvent {
			continue
		}
		_, _ = fmt.Fprintf(w, "data: %s\n\n", base64.StdEncoding.EncodeToString(frames.Wrap([]byte(payload))))
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
	}
}

func (ma *MockAgent) ResetHandlers() {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.handlers = defaultHandlers()
}

func (ma *MockAgent) Signer() *AgentResponseSigner {
	ma.mu.RLock()
	defer ma.mu.RUnlock()
	return ma.responseSigner
}

func (ma *MockAgent) Close() {
	if ma.server != nil {
		ma.server.CloseClientConnections()
		ma.server.Close()
	}
}
