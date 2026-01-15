package app

import (
	"context"
	"path/filepath"

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
	"berth/internal/ssl"
	"berth/internal/stack"
	"berth/internal/vulnscan"
	"berth/internal/websocket"
	"berth/models"
	"berth/providers"
	"berth/routes"
	"berth/seeds"
	"berth/utils"

	"github.com/tech-arch1tect/brx/app"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/revocation"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AppOptions struct {
	Config                *berthconfig.BerthConfig
	SkipConfigEnforcement bool
	CertFile              string
	KeyFile               string
	ExtraFxOptions        []fx.Option
}

func LoadConfig() (*berthconfig.BerthConfig, error) {
	var cfg berthconfig.BerthConfig
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

func NewApp(opts *AppOptions) *app.App {
	if opts == nil {
		opts = &AppOptions{}
	}

	var cfg *berthconfig.BerthConfig
	var err error
	if opts.Config != nil {
		cfg = opts.Config
	} else {
		if !opts.SkipConfigEnforcement {
			berthconfig.EnforceRequiredSettings()
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
		fx.Provide(func() *berthconfig.BerthConfig {
			return cfg
		}),
		fx.Provide(func(cfg *berthconfig.BerthConfig) *utils.Crypto {
			return utils.NewCrypto(cfg.Custom.EncryptionSecret)
		}),
		fx.Provide(func(cfg *berthconfig.BerthConfig, logger *logging.Service) (*operations.AuditLogger, error) {
			operationLogDir := filepath.Join(cfg.Custom.LogDir, "operations")
			maxSizeBytes := int64(cfg.Custom.LogFileSizeLimitMB) * 1024 * 1024
			return operations.NewAuditLogger(
				cfg.Custom.OperationLogLogToFile,
				operationLogDir,
				logger,
				maxSizeBytes,
			)
		}),
		fx.Invoke(func(auditLogger *operations.AuditLogger) {
			models.OperationLogAuditLogger = auditLogger
		}),
		fx.Provide(func(cfg *berthconfig.BerthConfig, logger *logging.Service) (*security.AuditLogger, error) {
			securityLogDir := filepath.Join(cfg.Custom.LogDir, "security")
			maxSizeBytes := int64(cfg.Custom.LogFileSizeLimitMB) * 1024 * 1024
			return security.NewAuditLogger(
				cfg.Custom.SecurityAuditLogLogToFile,
				securityLogDir,
				logger,
				maxSizeBytes,
			)
		}),
		fx.Invoke(func(auditLogger *security.AuditLogger) {
			models.SecurityAuditLogAuditor = auditLogger
		}),
		fx.Provide(security.NewAuditService),
		fx.Provide(func(logger *logging.Service, cfg *berthconfig.BerthConfig) *agent.Service {
			return agent.NewService(logger, cfg.Custom.OperationTimeoutSeconds)
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
		fx.Provide(func(db *gorm.DB, svc *server.Service, inertiaSvc *inertia.Service, auditSvc *security.AuditService) *server.Handler {
			return server.NewHandler(db, svc, inertiaSvc, auditSvc)
		}),
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
		vulnscan.Module,
		fx.Provide(security.NewHandler),
		fx.Provide(handlers.NewDashboardHandler),
		fx.Provide(handlers.NewStacksHandler),
		fx.Provide(handlers.NewAuthHandler),
		fx.Provide(handlers.NewMobileAuthHandler),
		fx.Provide(handlers.NewSessionHandler),
		fx.Provide(handlers.NewTOTPHandler),
		fx.Provide(handlers.NewVersionHandler),
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
			if err := seeds.SeedRBACData(db); err != nil {
				panic(err)
			}
		}),
	}

	fxOptions = append(fxOptions,
		websocket.Module,
		fx.Invoke(StartWebSocketHub),
		fx.Invoke(websocket.StartWebSocketServiceManager),
		fx.Invoke(func(svc *imageupdates.Service) {}),
		fx.Invoke(vulnscan.StartPoller),
		fx.Invoke(RegisterOperationAuditLoggerShutdown),
		fx.Invoke(RegisterSecurityAuditLoggerShutdown),
	)

	if len(opts.ExtraFxOptions) > 0 {
		fxOptions = append(fxOptions, opts.ExtraFxOptions...)
	}

	berthApp, err := app.NewApp().
		WithConfig(&cfg.Config).
		WithMail().
		WithDatabase(
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
		).
		WithSessionsNoMiddleware().
		WithInertiaNoMiddleware().
		WithAuth().
		WithTOTP().
		WithJWT().
		WithJWTRevocation().
		WithSSL(certFile, keyFile).
		WithFxOptions(fxOptions...).
		Build()

	if err != nil {
		panic(err)
	}

	return berthApp
}

func StartWebSocketHub(hub *websocket.Hub) {
	go hub.Run()
}

func RegisterOperationAuditLoggerShutdown(lc fx.Lifecycle, auditLogger *operations.AuditLogger, logger *logging.Service) {
	lc.Append(fx.Hook{
		OnStop: func(ctx context.Context) error {
			logger.Info("closing operation log audit logger")
			if err := auditLogger.Close(); err != nil {
				logger.Error("failed to close operation audit logger", zap.Error(err))
				return err
			}
			logger.Info("operation log audit logger closed successfully")
			return nil
		},
	})
}

func RegisterSecurityAuditLoggerShutdown(lc fx.Lifecycle, auditLogger *security.AuditLogger, logger *logging.Service) {
	lc.Append(fx.Hook{
		OnStop: func(ctx context.Context) error {
			logger.Info("closing security audit logger")
			if err := auditLogger.Close(); err != nil {
				logger.Error("failed to close security audit logger", zap.Error(err))
				return err
			}
			logger.Info("security audit logger closed successfully")
			return nil
		},
	})
}

func Run() {
	NewApp(nil).Run()
}

func Start() *app.App {
	berthApp := NewApp(nil)
	go berthApp.Start()
	return berthApp
}
