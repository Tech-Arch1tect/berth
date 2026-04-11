package harness

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/tech-arch1tect/brx/app"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

type E2EApp struct {
	App              *app.App
	TestServer       *httptest.Server
	BaseURL          string
	Config           *config.Config
	DB               *gorm.DB
	AuthSvc          *auth.Service
	cleanup          func()
	CoverageTracker  *CoverageTracker
	readinessCheck   func(ctx context.Context, app *E2EApp) error
	readinessTimeout time.Duration
}

type TestConfig struct {
	DatabaseURL      string
	DisableLogging   bool
	EnableDebugMode  bool
	TestPort         int
	OverrideConfig   func(*config.Config) *config.Config
	EnableCoverage   bool
	ExcludePatterns  []string
	ReadinessCheck   func(ctx context.Context, app *E2EApp) error
	ReadinessTimeout time.Duration
}

type HTTPClient struct {
	Client  *http.Client
	BaseURL string
}

func ProvideTestConfig() *TestConfig {
	return &TestConfig{
		DatabaseURL:     ":memory:",
		DisableLogging:  true,
		EnableDebugMode: true,
		TestPort:        0,
	}
}

func ProvideHTTPClient(e2eApp *E2EApp) *HTTPClient {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	baseURL := "http://localhost:8080"
	if e2eApp != nil && e2eApp.BaseURL != "" {
		baseURL = e2eApp.BaseURL
	}

	return &HTTPClient{
		Client:  client,
		BaseURL: baseURL,
	}
}

func ProvideE2EApp(testConfig *TestConfig, logger *logging.Service) (*E2EApp, error) {

	e2eApp := &E2EApp{
		Config: createTestConfig(testConfig),
	}

	return e2eApp, nil
}

func createTestConfig(testConfig *TestConfig) *config.Config {
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
			DSN:         testConfig.DatabaseURL,
			AutoMigrate: true,
		},
		Log: config.LogConfig{
			Level:  "panic",
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
		},
		Auth: config.AuthConfig{
			MinLength:                    8,
			RequireUpper:                 false,
			RequireLower:                 false,
			RequireNumber:                false,
			RequireSpecial:               false,
			PasswordResetEnabled:         true,
			PasswordResetTokenLength:     32,
			PasswordResetExpiry:          time.Hour,
			EmailVerificationEnabled:     true,
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
			AccessExpiry: time.Hour,
			Issuer:       "test-issuer",
			Algorithm:    "HS256",
		},
		Inertia: config.InertiaConfig{
			Enabled:     true,
			RootView:    "app.html",
			Development: true,
		},
		CSRF: config.CSRFConfig{
			Enabled: false,
		},
		Mail: config.MailConfig{
			FromAddress: "test@example.com",
			FromName:    "Test App",
			Host:        "localhost",
			Port:        587,
		},
	}

	if testConfig.DisableLogging {
		cfg.Log.Level = "fatal"
	}
	if testConfig.EnableDebugMode {
		cfg.Log.Level = "debug"
	}
	if testConfig.TestPort > 0 {
		cfg.Server.Port = fmt.Sprintf("%d", testConfig.TestPort)
	}

	if testConfig.OverrideConfig != nil {
		cfg = testConfig.OverrideConfig(cfg)
	}

	return cfg
}

func (e *E2EApp) Start(ctx context.Context) error {
	if e.App == nil {
		return fmt.Errorf("application not built - call BuildTestApp first")
	}

	if err := e.App.Start(); err != nil {
		return fmt.Errorf("failed to start test app: %w", err)
	}

	if err := e.waitForListener(); err != nil {
		return fmt.Errorf("server failed to become ready: %w", err)
	}

	if echoServer := e.App.Server(); echoServer != nil {
		if addr := echoServer.ListenerAddr(); addr != nil {
			e.BaseURL = fmt.Sprintf("http://%s", addr.String())
		} else {
			e.BaseURL = fmt.Sprintf("http://localhost:%s", e.Config.Server.Port)
		}
	} else {
		e.BaseURL = fmt.Sprintf("http://localhost:%s", e.Config.Server.Port)
	}

	if e.readinessCheck != nil {
		if err := e.waitForAppReady(ctx); err != nil {
			return fmt.Errorf("app readiness check failed: %w", err)
		}
	}

	return nil
}

func (e *E2EApp) waitForListener() error {
	echoServer := e.App.Server()
	if echoServer == nil {
		return fmt.Errorf("echo server not initialized")
	}

	deadline := time.After(e.readinessTimeout)
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()

	for {
		if addr := echoServer.ListenerAddr(); addr != nil {
			conn, err := net.DialTimeout("tcp", addr.String(), 100*time.Millisecond)
			if err == nil {
				conn.Close()
				return nil
			}
		}
		select {
		case <-ticker.C:
			continue
		case <-deadline:
			return fmt.Errorf("timeout after %s waiting for HTTP listener", e.readinessTimeout)
		}
	}
}

func (e *E2EApp) waitForAppReady(ctx context.Context) error {
	deadline := time.After(e.readinessTimeout)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	var lastErr error
	for {
		if err := e.readinessCheck(ctx, e); err == nil {
			return nil
		} else {
			lastErr = err
		}
		select {
		case <-ticker.C:
			continue
		case <-deadline:
			return fmt.Errorf("timeout after %s: last error: %w", e.readinessTimeout, lastErr)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (e *E2EApp) Stop(ctx context.Context) error {
	if e.TestServer != nil {
		e.TestServer.Close()
	}

	if e.App != nil {

		e.App.Stop()
	}

	if e.cleanup != nil {
		e.cleanup()
	}

	return nil
}

func BuildTestApp(builder *app.AppBuilder, testConfig *TestConfig) (*E2EApp, error) {

	cfg := createTestConfig(testConfig)
	builder = builder.WithConfig(cfg)

	var capturedDB *gorm.DB
	var capturedAuthSvc *auth.Service

	builder = builder.WithFxOptions(
		fx.Invoke(func(db *gorm.DB, authSvc *auth.Service) {
			capturedDB = db
			capturedAuthSvc = authSvc
		}),
	)

	builtApp, err := builder.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build test app: %w", err)
	}

	readinessTimeout := testConfig.ReadinessTimeout
	if readinessTimeout == 0 {
		readinessTimeout = 5 * time.Second
	}

	e2eApp := &E2EApp{
		App:              builtApp,
		Config:           cfg,
		DB:               capturedDB,
		AuthSvc:          capturedAuthSvc,
		readinessCheck:   testConfig.ReadinessCheck,
		readinessTimeout: readinessTimeout,
	}

	if testConfig.EnableCoverage {
		e2eApp.CoverageTracker = NewCoverageTracker()
		for _, pattern := range testConfig.ExcludePatterns {
			e2eApp.CoverageTracker.AddExcludePattern(pattern)
		}

		if echoServer := builtApp.Server(); echoServer != nil {
			echoServer.Use(e2eApp.CoverageTracker.TrackingMiddleware())
		}
	}

	return e2eApp, nil
}

func (e *E2EApp) InitCoverage() {
	if e.CoverageTracker == nil {
		return
	}
	if echoServer := e.App.Server(); echoServer != nil {
		e.CoverageTracker.RegisterRoutes(echoServer)
	}
}

func (e *E2EApp) GetCoverageStats() CoverageStats {
	if e.CoverageTracker == nil {
		return CoverageStats{}
	}
	return e.CoverageTracker.GetStats()
}

func (e *E2EApp) PrintCoverageReport() {
	if e.CoverageTracker == nil {
		fmt.Println("Coverage tracking not enabled")
		return
	}
	e.CoverageTracker.PrintReport()
}

func (e *E2EApp) GetMissingRoutes() []RouteInfo {
	if e.CoverageTracker == nil {
		return nil
	}
	return e.CoverageTracker.GetMissingRoutes()
}

func (e *E2EApp) AssertMinimumCoverage(t interface {
	Fatalf(format string, args ...any)
}, minPercent float64) {
	if e.CoverageTracker == nil {
		t.Fatalf("Coverage tracking not enabled")
		return
	}
	stats := e.CoverageTracker.GetStats()
	if stats.Coverage < minPercent {
		e.CoverageTracker.PrintReport()
		t.Fatalf("Coverage %.1f%% is below minimum required %.1f%%", stats.Coverage, minPercent)
	}
}
