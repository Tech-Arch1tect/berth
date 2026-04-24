package app

import (
	"berth/internal/domain/user"
	"context"
	"path/filepath"

	"berth/internal/domain/agent"
	"berth/internal/domain/apikey"
	"berth/internal/domain/dashboard"
	"berth/internal/domain/dataexport"
	"berth/internal/domain/files"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/logs"
	"berth/internal/domain/maintenance"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/operations"
	"berth/internal/domain/queue"
	"berth/internal/domain/rbac"
	"berth/internal/domain/registry"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/domain/setup"
	"berth/internal/domain/stack"
	"berth/internal/domain/version"
	"berth/internal/domain/vulnscan"
	"berth/internal/domain/websocket"
	"berth/internal/pkg/config"
	"berth/internal/pkg/crypto"
	"berth/internal/pkg/origin"
	"berth/routes"
	"berth/seeds"

	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/session"
	"berth/internal/platform/inertia"
	"berth/internal/platform/middleware/ratelimit"

	"github.com/labstack/echo/v4"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func DatabaseModels() []any {
	return []any{
		&user.User{}, &user.Role{}, &user.Permission{},
		&server.Server{}, &user.ServerRoleStackPermission{}, &server.ServerRegistryCredential{},
		&apikey.APIKey{}, &apikey.APIKeyScope{},
		&operationlogs.OperationLog{}, &operationlogs.OperationLogMessage{},
		&security.SecurityAuditLog{},
		&seeds.SeedTracker{},
		&queue.QueuedOperation{}, &session.UserSession{},
		&imageupdates.ContainerImageUpdate{},
		&vulnscan.ImageScan{}, &vulnscan.ImageVulnerability{}, &vulnscan.ScanScope{},
		&totp.TOTPSecret{}, &totp.UsedCode{},
		&auth.PasswordResetToken{}, &auth.EmailVerificationToken{}, &auth.RememberMeToken{},
		&tokens.RevokedToken{}, &tokens.RefreshToken{},
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
		fx.Provide(func(cfg *config.Config) origin.CheckOriginFunc {
			return origin.NewOriginChecker(cfg.App.URL)
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
		fx.Provide(func(db *gorm.DB, crypto *crypto.Crypto, rbacSvc *rbac.Service, agentSvc *agent.Service, logger *zap.Logger) *server.Service {
			return server.NewService(db, crypto, rbacSvc, agentSvc, logger)
		}),
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
		dataexport.Module,
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
