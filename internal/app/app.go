package app

import (
	"path/filepath"

	"berth/handlers"
	"berth/internal/agent"
	"berth/internal/apidocs"
	"berth/internal/apikey"
	berthconfig "berth/internal/config"
	"berth/internal/crypto"
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

	"github.com/tech-arch1tect/brx/app"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/openapi"
	brxserver "github.com/tech-arch1tect/brx/server"
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
		fx.Provide(func(cfg *berthconfig.BerthConfig) *crypto.Crypto {
			return crypto.NewCrypto(cfg.Custom.EncryptionSecret)
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
		fx.Provide(fx.Annotate(
			func(l *operations.AuditLogger) OperationLogAuditor { return l },
			fx.As(new(OperationLogAuditor)),
		)),
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
		fx.Provide(fx.Annotate(
			func(l *security.AuditLogger) SecurityLogAuditor { return l },
			fx.As(new(SecurityLogAuditor)),
		)),
		fx.Invoke(RegisterAuditCallbacks),
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
		fx.Provide(apidocs.NewOpenAPI),
		fx.Invoke(routes.RegisterAPIDocs),
		fx.Invoke(func(srv *brxserver.Server, apiDoc *openapi.OpenAPI, cfg *berthconfig.BerthConfig) {
			routes.RegisterOpenAPIEndpoints(srv.Echo(), apiDoc, cfg)
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
			if err := seeds.SeedRBACData(db); err != nil {
				panic(err)
			}
		}),
	}

	fxOptions = append(fxOptions,
		websocket.Module,
		fx.Invoke(func(svc *imageupdates.Service) {}),
		fx.Invoke(vulnscan.StartPoller),
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

func Run() {
	NewApp(nil).Run()
}

func Start() *app.App {
	berthApp := NewApp(nil)
	go berthApp.Start()
	return berthApp
}
