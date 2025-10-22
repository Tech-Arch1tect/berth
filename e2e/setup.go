package e2e

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"berth/models"
	"berth/providers"
	"berth/utils"

	mockpkg "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/app"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/revocation"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	e2etesting "github.com/tech-arch1tect/brx/testing"
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
	"berth/internal/websocket"
	"berth/routes"
	"berth/seeds"

	"github.com/tech-arch1tect/brx/testutils"
)

type TestApp struct {
	E2EApp        *e2etesting.E2EApp
	HTTPClient    *e2etesting.HTTPClient
	AuthHelper    *e2etesting.AuthHelper
	SessionHelper *e2etesting.SessionHelper
	dbFilePath    string
	cleanup       func()
}

func SetupTestApp(t *testing.T) *TestApp {

	tempDir := os.TempDir()
	dbFile := filepath.Join(tempDir, fmt.Sprintf("test_%s_%d.db", t.Name(), time.Now().UnixNano()))
	t.Logf("using test database: %s", dbFile)

	testConfig := &e2etesting.TestConfig{
		DatabaseURL:     dbFile,
		DisableLogging:  true,
		EnableDebugMode: false,
		OverrideConfig: func(cfg *config.Config) *config.Config {

			cfg.Auth.EmailVerificationEnabled = false
			cfg.Auth.RememberMeEnabled = true
			cfg.Auth.PasswordResetTokenLength = 32
			cfg.Auth.EmailVerificationTokenLength = 32
			cfg.Session.Store = "memory"
			cfg.CSRF.Enabled = false

			cfg.Inertia.RootView = "../app.html"
			cfg.Mail.TemplatesDir = filepath.Join("..", "testdata", "mail")
			return cfg
		},
	}

	e2eApp, err := e2etesting.BuildTestApp(
		app.NewApp().
			WithDatabase(
				&models.User{}, &models.Role{}, &models.Permission{},
				&models.Server{}, &models.ServerRoleStackPermission{}, &models.ServerRegistryCredential{},
				&models.APIKey{}, &models.APIKeyScope{},
				&models.OperationLog{}, &models.OperationLogMessage{},
				&models.SecurityAuditLog{},
				&models.SeedTracker{},
				&models.QueuedOperation{}, &session.UserSession{},
				&models.ContainerImageUpdate{},
				&totp.TOTPSecret{}, &totp.UsedCode{},
				&auth.PasswordResetToken{}, &auth.EmailVerificationToken{}, &auth.RememberMeToken{},
				&revocation.RevokedToken{}, &refreshtoken.RefreshToken{},
			).
			WithSessions().
			WithInertia().
			WithAuth().
			WithTOTP().
			WithJWT().
			WithJWTRevocation().
			WithFxOptions(
				jwt.Options,
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
				fx.Provide(func(cfg *berthconfig.BerthConfig) *utils.Crypto {
					return utils.NewCrypto(cfg.Custom.EncryptionSecret)
				}),
				fx.Provide(func(logger *logging.Service) *agent.Service {
					return agent.NewService(logger, 600)
				}),
				fx.Provide(rbac.NewService),
				fx.Provide(rbac.NewMiddleware),
				fx.Provide(rbac.NewRBACHandler),
				fx.Provide(rbac.NewAPIHandler),
				fx.Provide(func(db *gorm.DB, logger *logging.Service, rbacSvc *rbac.Service) *apikey.Service {
					return apikey.NewService(db, logger, rbacSvc)
				}),
				fx.Provide(apikey.NewHandler),
				fx.Provide(func(db *gorm.DB, rbacSvc *rbac.Service, logger *logging.Service) *setup.Service {
					return setup.NewService(db, rbacSvc, logger)
				}),
				fx.Provide(setup.NewHandler),
				fx.Provide(server.NewService),
				fx.Provide(server.NewHandler),
				fx.Provide(server.NewAPIHandler),
				fx.Provide(server.NewUserAPIHandler),
				fx.Provide(stack.NewService),
				fx.Provide(stack.NewHandler),
				fx.Provide(stack.NewAPIHandler),
				fx.Provide(maintenance.NewService),
				fx.Provide(maintenance.NewHandler),
				fx.Provide(maintenance.NewAPIHandler),
				files.Module,
				logs.Module,
				operations.Module,
				registry.Module,
				operationlogs.Module,
				migration.Module,
				queue.Module(),
				imageupdates.Module,
				fx.Provide(security.NewAuditService),
				fx.Provide(security.NewHandler),
				fx.Provide(handlers.NewDashboardHandler),
				fx.Provide(handlers.NewStacksHandler),
				fx.Provide(handlers.NewAuthHandler),
				fx.Provide(handlers.NewMobileAuthHandler),
				fx.Provide(handlers.NewSessionHandler),
				fx.Provide(handlers.NewTOTPHandler),
				fx.Provide(func() auth.MailService {
					mockSvc := &testutils.MockMailService{}
					mockSvc.On("SendTemplate", mockpkg.Anything, mockpkg.Anything, mockpkg.Anything, mockpkg.Anything).Return(nil)
					return mockSvc
				}),
				fx.Provide(fx.Annotate(
					providers.NewUserProvider,
					fx.As(new(inertiashared.UserProvider)),
				)),
				fx.Provide(fx.Annotate(
					providers.NewUserProvider,
					fx.As(new(jwtshared.UserProvider)),
				)),
				fx.Invoke(routes.RegisterRoutes),
				fx.Invoke(func(db *gorm.DB) {
					if err := seeds.SeedRBACData(db); err != nil {
					}
				}),
				websocket.Module,
				fx.Invoke(func(hub *websocket.Hub) {
					go hub.Run()
				}),
				fx.Invoke(websocket.StartWebSocketServiceManager),
				e2etesting.Module,
			),
		testConfig,
	)
	require.NoError(t, err, "failed to build test app")

	ctx := context.Background()
	err = e2eApp.Start(ctx)
	require.NoError(t, err, "failed to start test app")

	httpClient := &e2etesting.HTTPClient{
		Client:  http.DefaultClient,
		BaseURL: e2eApp.BaseURL,
	}

	authHelper := e2etesting.NewAuthHelper(httpClient, e2eApp.DB, e2eApp.AuthSvc)
	sessionHelper := e2etesting.NewSessionHelper(httpClient, e2eApp.DB)

	testApp := &TestApp{
		E2EApp:        e2eApp,
		HTTPClient:    httpClient,
		AuthHelper:    authHelper,
		SessionHelper: sessionHelper,
		dbFilePath:    dbFile,
		cleanup: func() {

			_ = e2eApp.Stop(ctx)

			if err := os.Remove(dbFile); err != nil && !os.IsNotExist(err) {
				t.Logf("error removing test database file %s: %v", dbFile, err)
			}
		},
	}

	t.Cleanup(testApp.cleanup)

	return testApp
}

func (app *TestApp) CreateVerifiedTestUser(t *testing.T) *e2etesting.TestUser {
	user := &e2etesting.TestUser{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	app.AuthHelper.CreateTestUser(t, user)

	err := app.AuthHelper.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", time.Now()).Error
	require.NoError(t, err, "failed to verify test user email")

	return user
}
