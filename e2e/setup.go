package e2e

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"berth/internal/app"
	"berth/internal/pkg/crypto"
	"berth/models"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/auth"
	"berth/internal/pkg/config"
	"berth/internal/platform/inertia"
	"berth/internal/platform/logging"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var (
	globalCoverageTracker     *e2etesting.CoverageTracker
	globalCoverageTrackerOnce sync.Once
	routesRegisteredOnce      sync.Once
)

func GetGlobalCoverageTracker() *e2etesting.CoverageTracker {
	globalCoverageTrackerOnce.Do(func() {
		globalCoverageTracker = e2etesting.NewCoverageTracker()

		globalCoverageTracker.AddExcludePattern("static")
		globalCoverageTracker.AddExcludePattern("assets")
	})
	return globalCoverageTracker
}

func PrintCoverageReport() {
	if globalCoverageTracker != nil {
		globalCoverageTracker.PrintReport()
	}
}

func GetCoverageStats() e2etesting.CoverageStats {
	if globalCoverageTracker == nil {
		return e2etesting.CoverageStats{}
	}
	return globalCoverageTracker.GetStats()
}

func TagTest(t interface{ Name() string }, method, path, category, value string) {
	e2etesting.TagTest(t, method, path, category, value)
}

func GetTestQualityStats() e2etesting.TestQualityStats {
	return e2etesting.GetTestTagTracker().GetStats()
}

func PrintTestQualityReport() {
	e2etesting.GetTestTagTracker().PrintReport()
}

type TestApp struct {
	Config        *config.Config
	DB            *gorm.DB
	Echo          *echo.Echo
	BaseURL       string
	AuthSvc       *auth.Service
	Mail          *e2etesting.CapturingMailService
	HTTPClient    *e2etesting.HTTPClient
	AuthHelper    *e2etesting.AuthHelper
	SessionHelper *e2etesting.SessionHelper

	fxApp      *fx.App
	dbFilePath string
	cleanup    func()
}

func buildTestConfig(dbFile string) *config.Config {
	return &config.Config{
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
			PasswordResetEnabled:         true,
			PasswordResetTokenLength:     32,
			PasswordResetExpiry:          time.Hour,
			EmailVerificationEnabled:     false,
			EmailVerificationTokenLength: 32,
			EmailVerificationExpiry:      time.Hour,
			RememberMeEnabled:            true,
			RememberMeTokenLength:        32,
			RememberMeExpiry:             24 * time.Hour,
			RememberMeCookieSecure:       false,
			RememberMeCookieSameSite:     "lax",
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
			RootView:    "../app.html",
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
			FromAddress:  "test@example.com",
			FromName:     "Test App",
			Host:         "localhost",
			Port:         587,
			TemplatesDir: filepath.Join("..", "testdata", "mail"),
		},
		Custom: config.AppCustomConfig{
			EncryptionSecret:                   "test-encryption-secret-key-32chars!!",
			LogDir:                             os.TempDir(),
			OperationLogLogToFile:              false,
			SecurityAuditLogLogToFile:          false,
			OperationTimeoutSeconds:            600,
			ImageUpdateCheckEnabled:            false,
			ImageUpdateCheckInterval:           "6h",
			ImageUpdateCheckDisabledRegistries: "",
		},
	}
}

func SetupTestApp(t *testing.T) *TestApp {
	return SetupTestAppWithConfig(t)
}

func SetupTestAppWithConfig(t *testing.T, modifiers ...func(*config.Config)) *TestApp {
	tempDir := os.TempDir()
	dbFile := filepath.Join(tempDir, fmt.Sprintf("test_%s_%d.db", t.Name(), time.Now().UnixNano()))
	t.Logf("using test database: %s", dbFile)

	cfg := buildTestConfig(dbFile)
	for _, mod := range modifiers {
		mod(cfg)
	}

	logger, err := logging.NewLogger(cfg)
	require.NoError(t, err, "failed to create logger")

	db, err := app.OpenDatabase(cfg, logger, app.DatabaseModels()...)
	require.NoError(t, err, "failed to initialize database")

	inertiaSvc := inertia.New(&cfg.Inertia, app.SessionStoreResolver, logger)

	mailSvc := e2etesting.NewCapturingMailService()

	e := app.NewEcho(cfg, logger)

	var capturedAuthSvc *auth.Service

	fxOpts := []fx.Option{
		fx.NopLogger,

		fx.Supply(cfg),
		fx.Supply(logger),
		fx.Supply(db),
		fx.Supply(inertiaSvc),
		fx.Supply(e),
		fx.Supply(&app.SSLConfig{Enabled: false}),

		fx.Provide(func() auth.MailService {
			return mailSvc
		}),

		app.CoreFxOptions(),

		fx.Invoke(func(srv *echo.Echo, authSvc *auth.Service) {
			capturedAuthSvc = authSvc

			tracker := GetGlobalCoverageTracker()
			srv.Use(tracker.TrackingMiddleware())
			routesRegisteredOnce.Do(func() {
				tracker.RegisterRoutes(srv)
			})
		}),
		fx.Invoke(app.RegisterHTTPLifecycle),
	}

	fxApp := fx.New(fxOpts...)

	ctx := context.Background()
	err = fxApp.Start(ctx)
	require.NoError(t, err, "failed to start test app")

	require.NotNil(t, e, "echo server not initialised")

	baseURL := waitForListener(t, e, 5*time.Second)
	waitForRBACSeeded(t, db, 5*time.Second)

	httpClient := &e2etesting.HTTPClient{
		Client:  http.DefaultClient,
		BaseURL: baseURL,
	}

	authHelper := e2etesting.NewAuthHelper(httpClient, db, capturedAuthSvc)
	sessionHelper := e2etesting.NewSessionHelper(httpClient, db)

	testApp := &TestApp{
		Config:        cfg,
		DB:            db,
		Echo:          e,
		BaseURL:       baseURL,
		AuthSvc:       capturedAuthSvc,
		Mail:          mailSvc,
		HTTPClient:    httpClient,
		AuthHelper:    authHelper,
		SessionHelper: sessionHelper,
		fxApp:         fxApp,
		dbFilePath:    dbFile,
		cleanup: func() {
			stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = fxApp.Stop(stopCtx)

			if err := os.Remove(dbFile); err != nil && !os.IsNotExist(err) {
				t.Logf("error removing test database file %s: %v", dbFile, err)
			}
		},
	}

	t.Cleanup(testApp.cleanup)

	return testApp
}

func waitForListener(t *testing.T, e *echo.Echo, timeout time.Duration) string {
	deadline := time.After(timeout)
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()

	for {
		if addr := e.ListenerAddr(); addr != nil {
			conn, err := net.DialTimeout("tcp", addr.String(), 100*time.Millisecond)
			if err == nil {
				conn.Close()
				return fmt.Sprintf("http://%s", addr.String())
			}
		}
		select {
		case <-ticker.C:
			continue
		case <-deadline:
			t.Fatalf("timeout after %s waiting for HTTP listener", timeout)
			return ""
		}
	}
}

func waitForRBACSeeded(t *testing.T, db *gorm.DB, timeout time.Duration) {
	deadline := time.After(timeout)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	for {
		var roleCount, permCount int64
		err1 := db.Raw("SELECT COUNT(*) FROM roles").Scan(&roleCount).Error
		err2 := db.Raw("SELECT COUNT(*) FROM permissions").Scan(&permCount).Error
		if err1 == nil && err2 == nil && roleCount > 0 && permCount > 0 {
			return
		}
		select {
		case <-ticker.C:
			continue
		case <-deadline:
			t.Fatalf("timeout after %s waiting for RBAC seed (roles=%d perms=%d)", timeout, roleCount, permCount)
			return
		}
	}
}

func (a *TestApp) CreateVerifiedTestUser(t *testing.T) *e2etesting.TestUser {
	user := &e2etesting.TestUser{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	a.AuthHelper.CreateTestUser(t, user)

	err := a.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", time.Now()).Error
	require.NoError(t, err, "failed to verify test user email")

	return user
}

func (a *TestApp) CreateTestServer(t *testing.T, name string, mockAgentURL string) *models.Server {
	crypto := crypto.NewCrypto("test-encryption-secret-key-32chars!!")
	encryptedToken, err := crypto.Encrypt("test-access-token")
	require.NoError(t, err, "failed to encrypt access tokene")

	host := mockAgentURL
	port := 443

	if strings.HasPrefix(mockAgentURL, "https://") {
		hostPort := strings.TrimPrefix(mockAgentURL, "https://")
		parts := strings.Split(hostPort, ":")
		if len(parts) == 2 {
			host = parts[0]
			if p, err := strconv.Atoi(parts[1]); err == nil {
				port = p
			}
		}
	}

	skipSSL := true
	server := &models.Server{
		Name:                name,
		Host:                host,
		Port:                port,
		AccessToken:         encryptedToken,
		SkipSSLVerification: &skipSSL,
		IsActive:            true,
	}

	err = a.DB.Create(server).Error
	require.NoError(t, err, "failed to create test server")

	return server
}

func (a *TestApp) CreateTestServerWithAgent(t *testing.T, name string) (*MockAgent, *models.Server) {
	mockAgent := NewMockAgent()
	t.Cleanup(mockAgent.Close)

	server := a.CreateTestServer(t, name, mockAgent.URL)
	return mockAgent, server
}

func (a *TestApp) CreateAdminTestUser(t *testing.T, user *e2etesting.TestUser) {
	a.AuthHelper.CreateTestUser(t, user)

	var adminRole models.Role
	err := a.DB.Where("name = ?", "admin").First(&adminRole).Error
	require.NoError(t, err, "failed to find admin role")

	err = a.DB.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", user.ID, adminRole.ID).Error
	require.NoError(t, err, "failed to assign admin role to user")
}
