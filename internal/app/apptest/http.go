package apptest

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func WaitForListener(t *testing.T, e *echo.Echo, timeout time.Duration) string {
	t.Helper()

	deadline := time.After(timeout)
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()

	for {
		if addr := e.TLSListenerAddr(); addr != nil {
			conn, err := net.DialTimeout("tcp", addr.String(), 100*time.Millisecond)
			if err == nil {
				conn.Close()
				return fmt.Sprintf("https://%s", addr.String())
			}
		}
		select {
		case <-ticker.C:
			continue
		case <-deadline:
			t.Fatalf("timeout after %s waiting for HTTPS listener", timeout)
			return ""
		}
	}
}

func NewTLSClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
}
