package app

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestServiceWorkerServedWithRootScopeHeader(t *testing.T) {
	publicDir := t.TempDir()
	writeFile(t, filepath.Join(publicDir, "build", "sw.js"), "// service worker")

	e := echo.New()
	registerStaticAssetRoutes(e, publicDir)

	rec := doGet(e, "/build/sw.js")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Service-Worker-Allowed"); got != "/" {
		t.Errorf("Service-Worker-Allowed = %q, want %q", got, "/")
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want %q", got, "no-cache")
	}
	if ct := rec.Header().Get(echo.HeaderContentType); ct != "text/javascript; charset=utf-8" {
		t.Errorf("Content-Type = %q, want text/javascript; charset=utf-8", ct)
	}
	if rec.Body.String() != "// service worker" {
		t.Errorf("body = %q, want the sw.js file contents", rec.Body.String())
	}
}

func TestManifestServedWithManifestContentType(t *testing.T) {
	publicDir := t.TempDir()
	writeFile(t, filepath.Join(publicDir, "pwa", "manifest.webmanifest"), `{"name":"berth"}`)

	e := echo.New()
	registerStaticAssetRoutes(e, publicDir)

	rec := doGet(e, "/pwa/manifest.webmanifest")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get(echo.HeaderContentType); ct != "application/manifest+json" {
		t.Errorf("Content-Type = %q, want application/manifest+json", ct)
	}
}

func TestPWAIconsServed(t *testing.T) {
	publicDir := t.TempDir()
	writeFile(t, filepath.Join(publicDir, "pwa", "icon-192.png"), "PNGDATA")

	e := echo.New()
	registerStaticAssetRoutes(e, publicDir)

	rec := doGet(e, "/pwa/icon-192.png")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "PNGDATA" {
		t.Errorf("body = %q, want icon file contents", rec.Body.String())
	}
}

func writeFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func doGet(e *echo.Echo, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}
