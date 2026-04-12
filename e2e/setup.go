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

	"berth/internal/common"
	"berth/internal/crypto"
	"berth/models"
	"berth/providers"

	e2etesting "berth/e2e/internal/harness"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/database"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/middleware/ratelimit"
	brxserver "github.com/tech-arch1tect/brx/server"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/revocation"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/fx"
	"gorm.io/gorm"

	"berth/handlers"
	"berth/internal/agent"
	"berth/internal/apikey"
	berthconfig "berth/internal/config"
	"berth/internal/files"
	"berth/internal/imageupdates"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/migration"
	"berth/internal/operationlogs"
	"berth/internal/operations"
	"berth/internal/queue"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/stack"
	"berth/internal/vulnscan"
	"berth/internal/websocket"
	"berth/routes"
	"berth/seeds"
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
			RotationMode:    "always",
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
			Enabled:     true,
			RootView:    "../app.html",
			Development: true,
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

	logger, err := logging.NewService(logging.Config{
		Level:      logging.LogLevel(cfg.Log.Level),
		Format:     cfg.Log.Format,
		OutputPath: cfg.Log.Output,
	})
	require.NoError(t, err, "failed to create logger")

	modelsOpt := database.WithModels(
		&models.User{}, &models.Role{}, &models.Permission{},
		&models.Server{}, &models.ServerRoleStackPermission{}, &models.ServerRegistryCredential{},
		&models.APIKey{}, &models.APIKeyScope{},
		&models.OperationLog{}, &models.OperationLogMessage{},
		&models.SecurityAuditLog{},
		&models.SeedTracker{},
		&models.QueuedOperation{}, &session.UserSession{},
		&models.ContainerImageUpdate{},
		&models.ImageScan{}, &models.ImageVulnerability{}, &models.ScanScope{},
		&totp.TOTPSecret{}, &totp.UsedCode{},
		&auth.PasswordResetToken{}, &auth.EmailVerificationToken{}, &auth.RememberMeToken{},
		&revocation.RevokedToken{}, &refreshtoken.RefreshToken{},
	)

	db, err := database.ProvideDatabase(*cfg, modelsOpt, logger)
	require.NoError(t, err, "failed to initialize database")

	inertiaSvc := inertia.New(&cfg.Inertia, logger)

	mailSvc := e2etesting.NewCapturingMailService()

	var nilSessionOpts *session.Options

	var (
		capturedServer  *brxserver.Server
		capturedAuthSvc *auth.Service
	)

	fxOpts := []fx.Option{
		fx.NopLogger,

		fx.Supply(cfg),
		fx.Supply(logger),
		fx.Supply(db),
		fx.Supply(inertiaSvc),
		fx.Supply(nilSessionOpts),
		fx.Supply(&brxserver.SSLConfig{Enabled: false}),

		brxserver.NewProvider(),
		fx.Provide(ratelimit.ProvideRateLimitStore),

		session.Module,
		auth.Module,
		totp.Module,
		fx.Provide(refreshtoken.ProvideRefreshTokenService),
		revocation.Module,
		jwt.Options,

		fx.Invoke(func(srv *brxserver.Server, sessionMgr *session.Manager) {
			srv.Echo().Use(session.Middleware(sessionMgr))
		}),
		fx.Invoke(func(srv *brxserver.Server, inSvc *inertia.Service, userProvider inertiashared.UserProvider) {
			srv.Echo().Use(inSvc.Middleware())
			srv.Echo().Use(inertiashared.MiddlewareWithConfig(inertiashared.Config{
				AuthEnabled:  true,
				FlashEnabled: true,
				UserProvider: userProvider,
			}))
		}),

		fx.Invoke(func(lc fx.Lifecycle, svc *inertia.Service) {
			lc.Append(fx.Hook{
				OnStart: func(ctx context.Context) error {
					rootView := cfg.Inertia.RootView
					if rootView == "" {
						rootView = "app.html"
					}
					if err := svc.InitializeFromFile(rootView); err != nil {
						return err
					}
					svc.ShareAssetData()
					return nil
				},
			})
		}),

		fx.Provide(func(cfg *config.Config) *berthconfig.BerthConfig {
			return &berthconfig.BerthConfig{
				Config: *cfg,
				Custom: berthconfig.AppCustomConfig{
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
		}),
		fx.Provide(func(cfg *berthconfig.BerthConfig) *crypto.Crypto {
			return crypto.NewCrypto(cfg.Custom.EncryptionSecret)
		}),
		fx.Provide(func(cfg *berthconfig.BerthConfig) common.CheckOriginFunc {
			return common.NewOriginChecker(cfg.App.URL)
		}),

		agent.Module,
		rbac.Module,
		fx.Provide(func(db *gorm.DB, logger *logging.Service, rbacSvc *rbac.Service) *apikey.Service {
			return apikey.NewService(db, logger, rbacSvc)
		}),
		apikey.Module,
		setup.Module,
		server.Module,
		stack.Module,
		maintenance.Module,
		security.Module,
		handlers.Module,
		files.Module,
		logs.Module,
		operations.Module,
		registry.Module,
		operationlogs.Module,
		migration.Module,
		queue.Module,
		imageupdates.Module,
		vulnscan.Module,
		websocket.Module,

		fx.Provide(func() auth.MailService {
			return mailSvc
		}),
		fx.Provide(fx.Annotate(
			providers.NewUserProvider,
			fx.As(new(inertiashared.UserProvider)),
		)),
		fx.Provide(fx.Annotate(
			providers.NewUserProvider,
			fx.As(new(jwtshared.UserProvider)),
		)),
		fx.Provide(func(svc refreshtoken.RefreshTokenService) session.RefreshTokenRevocationService {
			return svc
		}),

		fx.Invoke(routes.RegisterRoutes),
		fx.Invoke(func(db *gorm.DB) {
			_ = seeds.SeedRBACData(db)
		}),

		fx.Invoke(func(srv *brxserver.Server, authSvc *auth.Service) {
			capturedServer = srv
			capturedAuthSvc = authSvc

			tracker := GetGlobalCoverageTracker()
			srv.Echo().Use(tracker.TrackingMiddleware())
			routesRegisteredOnce.Do(func() {
				tracker.RegisterRoutes(srv.Echo())
			})
		}),
	}

	fxApp := fx.New(fxOpts...)

	ctx := context.Background()
	err = fxApp.Start(ctx)
	require.NoError(t, err, "failed to start test app")

	require.NotNil(t, capturedServer, "brx server was not captured from fx")
	echoServer := capturedServer.Echo()
	require.NotNil(t, echoServer, "echo server not initialised")

	baseURL := waitForListener(t, echoServer, 5*time.Second)
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
		Echo:          echoServer,
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

func (app *TestApp) CreateVerifiedTestUser(t *testing.T) *e2etesting.TestUser {
	user := &e2etesting.TestUser{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	app.AuthHelper.CreateTestUser(t, user)

	err := app.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", time.Now()).Error
	require.NoError(t, err, "failed to verify test user email")

	return user
}

func (app *TestApp) CreateTestServer(t *testing.T, name string, mockAgentURL string) *models.Server {
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

	err = app.DB.Create(server).Error
	require.NoError(t, err, "failed to create test server")

	return server
}

func (app *TestApp) CreateTestServerWithAgent(t *testing.T, name string) (*MockAgent, *models.Server) {
	mockAgent := NewMockAgent()
	t.Cleanup(mockAgent.Close)

	server := app.CreateTestServer(t, name, mockAgent.URL)
	return mockAgent, server
}

func (app *TestApp) CreateAdminTestUser(t *testing.T, user *e2etesting.TestUser) {
	app.AuthHelper.CreateTestUser(t, user)

	var adminRole models.Role
	err := app.DB.Where("name = ?", "admin").First(&adminRole).Error
	require.NoError(t, err, "failed to find admin role")

	err = app.DB.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", user.ID, adminRole.ID).Error
	require.NoError(t, err, "failed to assign admin role to user")
}
