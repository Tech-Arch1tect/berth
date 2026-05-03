package apptest

import (
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"berth/internal/pkg/config"
)

func repoRoot() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", ".."))
}

func BuildConfig(t *testing.T, modifiers ...func(*config.Config)) *config.Config {
	t.Helper()

	tempDir := t.TempDir()
	dbFile := filepath.Join(tempDir, "test.db")
	rootView := filepath.Join(repoRoot(), "app.html")

	cfg := &config.Config{
		App: config.AppConfig{
			Name: "Test App",
			URL:  "http://localhost:8080",
		},
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "0",
		},
		Database: config.DatabaseConfig{
			Driver:      "sqlite",
			DSN:         dbFile,
			AutoMigrate: true,
		},
		Log: config.LogConfig{
			Level:  "fatal",
			Format: "json",
			Output: "stdout",
		},
		Session: config.SessionConfig{
			Enabled:  true,
			Store:    "memory",
			Name:     "test_session",
			MaxAge:   time.Hour,
			Secure:   false,
			HttpOnly: true,
			SameSite: "lax",
			Path:     "/",
		},
		Auth: config.AuthConfig{
			MinLength:                    8,
			BcryptCost:                   4,
			PasswordResetEnabled:         true,
			PasswordResetTokenLength:     32,
			PasswordResetExpiry:          time.Hour,
			EmailVerificationEnabled:     false,
			EmailVerificationTokenLength: 32,
			EmailVerificationExpiry:      time.Hour,
			RememberMeEnabled:            true,
			RememberMeTokenLength:        32,
			RememberMeExpiry:             24 * time.Hour,
		},
		JWT: config.JWTConfig{
			SecretKey:    "test-secret-key-for-testing-only",
			AccessExpiry: 15 * time.Minute,
			Issuer:       "test-issuer",
			Algorithm:    "HS256",
		},
		RefreshToken: config.RefreshTokenConfig{
			TokenLength:     32,
			Expiry:          30 * 24 * time.Hour,
			CleanupInterval: time.Hour,
		},
		Revocation: config.RevocationConfig{
			Enabled:       true,
			Store:         "memory",
			CleanupPeriod: time.Hour,
		},
		TOTP: config.TOTPConfig{
			Enabled: true,
			Issuer:  "Test App",
		},
		Inertia: config.InertiaConfig{
			RootView:    rootView,
			Development: true,
		},
		RateLimit: config.RateLimitConfig{
			Enabled: false,
		},
		CSRF: config.CSRFConfig{
			Enabled:        true,
			TokenLength:    32,
			TokenLookup:    "header:X-CSRF-Token",
			ContextKey:     "csrf",
			CookieName:     "_csrf",
			CookiePath:     "/",
			CookieMaxAge:   86400,
			CookieSecure:   false,
			CookieHTTPOnly: false,
			CookieSameSite: "lax",
		},
		Mail: config.MailConfig{
			FromAddress: "test@example.com",
			FromName:    "Test App",
			Host:        "localhost",
			Port:        587,
		},
		Custom: config.AppCustomConfig{
			EncryptionSecret:                   "test-encryption-secret-key-32chars!!",
			LogDir:                             tempDir,
			OperationLogLogToFile:              false,
			SecurityAuditLogLogToFile:          false,
			OperationTimeoutSeconds:            600,
			ImageUpdateCheckEnabled:            false,
			ImageUpdateCheckInterval:           "6h",
			ImageUpdateCheckDisabledRegistries: "",
		},
	}

	for _, mod := range modifiers {
		mod(cfg)
	}
	return cfg
}
