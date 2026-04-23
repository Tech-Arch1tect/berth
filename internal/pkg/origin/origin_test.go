package origin

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewOriginChecker(t *testing.T) {
	tests := []struct {
		name    string
		appURL  string
		origin  string
		allowed bool
	}{
		{"empty origin passes", "https://app.example.com", "", true},
		{"matching origin", "https://app.example.com", "https://app.example.com", true},
		{"mismatched host", "https://app.example.com", "https://evil.example.com", false},
		{"mismatched scheme", "https://app.example.com", "http://app.example.com", false},
		{"with path in appURL ignored", "https://app.example.com/dashboard", "https://app.example.com", true},
		{"subdomain not allowed", "https://app.example.com", "https://sub.app.example.com", false},
		{"port mismatch", "https://app.example.com:8080", "https://app.example.com", false},
		{"port match", "https://app.example.com:8080", "https://app.example.com:8080", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			check := NewOriginChecker(tt.appURL)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			got := check(req)
			if got != tt.allowed {
				t.Errorf("NewOriginChecker(%q)(Origin=%q) = %v, want %v", tt.appURL, tt.origin, got, tt.allowed)
			}
		})
	}
}

func TestNewOriginCheckerInvalidAppURL(t *testing.T) {
	check := NewOriginChecker("")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://anything.example.com")
	if check(req) {
		t.Error("invalid appURL should reject all origins with a Origin header")
	}

	check2 := NewOriginChecker("://bad")
	if check2(req) {
		t.Error("malformed appURL should reject all origins with an Origin header")
	}
}
