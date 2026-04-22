package app

import (
	"context"
	"path/filepath"

	"berth/internal/agent"
	"berth/internal/apikey"
	"berth/internal/common"
	"berth/internal/config"
	"berth/internal/dashboard"
	"berth/internal/files"
	"berth/internal/imageupdates"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/migration"
	"berth/internal/operationlogs"
	"berth/internal/operations"
	"berth/internal/pkg/crypto"
	"berth/internal/queue"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/stack"
	"berth/internal/version"
	"berth/internal/vulnscan"
	"berth/internal/websocket"
	"berth/models"
	"berth/routes"
	"berth/seeds"

	"berth/internal/auth"
	"berth/internal/auth/tokens"
	"berth/internal/auth/totp"
	"berth/internal/inertia"
	"berth/internal/middleware/ratelimit"
	"berth/internal/session"

	"github.com/labstack/echo/v4"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func DatabaseModels() []any {
	return []any{
		&models.User{}, &models.Role{}, &models.Permission{},
		&models.Server{}, &models.ServerRoleStackPermission{}, &models.ServerRegistryCredential{},
		&models.APIKey{}, &models.APIKeyScope{},
		&models.OperationLog{}, &models.OperationLogMessage{},
		&models.SecurityAuditLog{},
		&models.SeedTracker{},
		&models.QueuedOperation{}, &models.UserSession{},
		&models.ContainerImageUpdate{},
		&models.ImageScan{}, &models.ImageVulnerability{}, &models.ScanScope{},
		&models.TOTPSecret{}, &models.UsedCode{},
		&models.PasswordResetToken{}, &models.EmailVerificationToken{}, &models.RememberMeToken{},
		&tokens.RevokedToken{}, &models.RefreshToken{},
	}
}

func CoreFxOptions() fx.Option {
	return fx.Options(
		fx.Provide(ratelimit.NewStore),

		tokens.Module,
		session.Module,
		auth.Module,
		totp.Module,

		fx.Provide(func(s *session.Service) auth.SessionInvalidator {
			if s == nil {
				return nil
			}
			return s
		}),

		fx.Invoke(func(e *echo.Echo, sessionMgr *session.Manager) {
			e.Use(session.Middleware(sessionMgr))
		}),
		fx.Invoke(func(e *echo.Echo, inSvc *inertia.Service, userProvider auth.UserProvider) {
			e.Use(inSvc.Middleware())
			e.Use(inertia.SharedContext(
				userProvider.GetUser,
				session.IsAuthenticated,
				session.GetUserIDAsUint,
				InertiaFlashMessages,
			))
		}),

		fx.Invoke(func(lc fx.Lifecycle, cfg *config.Config, svc *inertia.Service) {
			lc.Append(fx.Hook{
				OnStart: func(ctx context.Context) error {
					rootView := cfg.Inertia.RootView
					if rootView == "" {
						rootView = "app.html"
					}
					if err := svc.InitializeFromFile(rootView); err != nil {
						return err
					}
					if !cfg.Inertia.Development {
						_ = svc.LoadManifest("public/build/.vite/manifest.json")
					}
					svc.ShareAssetData()
					return nil
				},
			})
		}),

		fx.Provide(func(cfg *config.Config) *crypto.Crypto {
			return crypto.NewCrypto(cfg.Custom.EncryptionSecret)
		}),
		fx.Provide(func(cfg *config.Config) common.CheckOriginFunc {
			return common.NewOriginChecker(cfg.App.URL)
		}),
		fx.Provide(func(cfg *config.Config, logger *zap.Logger) (*operations.AuditLogger, error) {
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
		fx.Provide(func(cfg *config.Config, logger *zap.Logger) (*security.AuditLogger, error) {
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
		fx.Provide(func(db *gorm.DB, logger *zap.Logger, rbacSvc *rbac.Service) *apikey.Service {
			return apikey.NewService(db, logger, rbacSvc)
		}),
		apikey.Module,
		setup.Module,
		server.Module,
		stack.Module,
		dashboard.Module,
		maintenance.Module,
		security.Module,
		files.Module,
		logs.Module,
		operations.Module,
		registry.Module,
		operationlogs.Module,
		migration.Module,
		queue.Module,
		imageupdates.Module,
		version.Module,
		vulnscan.Module,
		websocket.Module,

		fx.Invoke(routes.RegisterRoutes),
		fx.Invoke(func(db *gorm.DB) {
			if err := seeds.SeedRBACData(db); err != nil {
				panic(err)
			}
		}),
	)
}
