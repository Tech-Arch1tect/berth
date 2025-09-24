package app

import (
	"berth/handlers"
	"berth/internal/agent"
	configEnforcement "berth/internal/config"
	"berth/internal/files"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/migration"
	"berth/internal/operationlogs"
	"berth/internal/operations"
	"berth/internal/queue"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/ssl"
	"berth/internal/stack"
	"berth/internal/webhook"
	"berth/internal/websocket"
	"berth/models"
	"berth/providers"
	"berth/routes"
	"berth/seeds"
	"berth/utils"

	"github.com/tech-arch1tect/brx"
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
	"go.uber.org/fx"
	"gorm.io/gorm"
)

type BerthConfig struct {
	config.Config
	Custom AppCustomConfig `envPrefix:""`
}

type AppCustomConfig struct {
	EncryptionSecret string `env:"ENCRYPTION_SECRET"`
}

type AppOptions struct {
	Config                *BerthConfig
	SkipConfigEnforcement bool
	CertFile              string
	KeyFile               string
	ExtraFxOptions        []fx.Option
}

func LoadConfig() (*BerthConfig, error) {
	var cfg BerthConfig
	if err := config.LoadConfig(&cfg); err != nil {
		return nil, err
	}

	if cfg.Custom.EncryptionSecret == "" {
		panic("CUSTOM_ENCRYPTION_SECRET is required but not set. Please set this environment variable with a secure secret key (minimum 32 characters). You can generate one with: openssl rand -base64 32")
	}

	if len(cfg.Custom.EncryptionSecret) < 16 {
		panic("CUSTOM_ENCRYPTION_SECRET must be at least 16 characters long for security. Please use a longer secret key. You can generate one with: openssl rand -base64 32")
	}

	return &cfg, nil
}

func NewApp(opts *AppOptions) *brx.App {
	if opts == nil {
		opts = &AppOptions{}
	}

	var cfg *BerthConfig
	var err error
	if opts.Config != nil {
		cfg = opts.Config
	} else {
		if !opts.SkipConfigEnforcement {
			configEnforcement.EnforceRequiredSettings()
		}
		cfg, err = LoadConfig()
		if err != nil {
			panic(err)
		}
	}
	var certFile, keyFile string
	if opts.CertFile != "" && opts.KeyFile != "" {
		certFile = opts.CertFile
		keyFile = opts.KeyFile
	} else {
		certManager := ssl.NewCertificateManager()
		certFile, keyFile, err = certManager.EnsureCertificates()
		if err != nil {
			panic(err)
		}
	}

	fxOptions := []fx.Option{
		jwt.Options,
		fx.Provide(func() *BerthConfig {
			return cfg
		}),
		fx.Provide(func(cfg *BerthConfig) *utils.Crypto {
			return utils.NewCrypto(cfg.Custom.EncryptionSecret)
		}),
		fx.Provide(agent.NewService),
		fx.Provide(rbac.NewService),
		fx.Provide(rbac.NewMiddleware),
		fx.Provide(rbac.NewRBACHandler),
		fx.Provide(rbac.NewAPIHandler),
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
		operationlogs.Module,
		migration.Module,
		queue.Module(),
		webhook.Module(),
		fx.Provide(handlers.NewDashboardHandler),
		fx.Provide(handlers.NewAuthHandler),
		fx.Provide(handlers.NewMobileAuthHandler),
		fx.Provide(handlers.NewSessionHandler),
		fx.Provide(handlers.NewTOTPHandler),
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
				panic(err)
			}
		}),
	}

	fxOptions = append(fxOptions,
		websocket.Module,
		fx.Invoke(StartWebSocketHub),
		fx.Invoke(websocket.StartWebSocketServiceManager),
	)

	if len(opts.ExtraFxOptions) > 0 {
		fxOptions = append(fxOptions, opts.ExtraFxOptions...)
	}
	fxOptsAsAny := make([]any, len(fxOptions))
	for i, opt := range fxOptions {
		fxOptsAsAny[i] = opt
	}

	app := brx.New(
		brx.WithConfig(&cfg.Config),
		brx.WithMail(),
		brx.WithDatabase(&models.User{}, &models.Role{}, &models.Permission{}, &models.Server{}, &models.ServerRoleStackPermission{}, &models.OperationLog{}, &models.OperationLogMessage{}, &models.SeedTracker{}, &models.Webhook{}, &models.WebhookServerScope{}, &models.QueuedOperation{}, &session.UserSession{}, &totp.TOTPSecret{}, &totp.UsedCode{}, &auth.PasswordResetToken{}, &auth.EmailVerificationToken{}, &auth.RememberMeToken{}, &revocation.RevokedToken{}, &refreshtoken.RefreshToken{}),
		brx.WithSessionsNoGlobalMiddleware(),
		brx.WithInertiaNoGlobalMiddleware(),
		brx.WithAuth(),
		brx.WithTOTP(),
		brx.WithJWT(),
		brx.WithJWTRevocation(),
		brx.WithSSL(certFile, keyFile),
		brx.WithFxOptions(fxOptsAsAny...),
	)

	return app
}

func StartWebSocketHub(hub *websocket.Hub) {
	go hub.Run()
}

func Run() {
	NewApp(nil).Run()
}

func Start() *brx.App {
	app := NewApp(nil)
	go app.Start()
	return app
}
