package apptest

import (
	"os"
	"sync"
	"testing"

	"berth/internal/platform/ssl"

	"github.com/stretchr/testify/require"
)

var (
	sslCertOnce sync.Once
	sslCertFile string
	sslKeyFile  string
	sslCertErr  error
)

func ensureSSLCerts(t *testing.T) (string, string) {
	t.Helper()
	sslCertOnce.Do(func() {
		dir, err := os.MkdirTemp("", "berth-apptest-ssl-")
		if err != nil {
			sslCertErr = err
			return
		}
		sslCertFile, sslKeyFile, sslCertErr = ssl.NewCertificateManagerIn(dir).EnsureCertificates()
	})
	require.NoError(t, sslCertErr, "failed to generate test SSL certificates")
	return sslCertFile, sslKeyFile
}
