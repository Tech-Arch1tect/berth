package main

import (
	"berth/handlers"
	"berth/internal/agent"
	"berth/internal/files"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/operations"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/stack"
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
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/revocation"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func main() {
	var cfg BerthConfig
	if err := config.LoadConfig(&cfg); err != nil {
		panic(err)
	}

	if cfg.Custom.EncryptionSecret == "" {
		panic("CUSTOM_ENCRYPTION_SECRET is required but not set. Please set this environment variable with a secure secret key (minimum 32 characters). You can generate one with: openssl rand -base64 32")
	}

	if len(cfg.Custom.EncryptionSecret) < 16 {
		panic("CUSTOM_ENCRYPTION_SECRET must be at least 16 characters long for security. Please use a longer secret key. You can generate one with: openssl rand -base64 32")
	}

	brx.New(
		brx.WithConfig(&cfg.Config),
		brx.WithMail(),
		brx.WithDatabase(&models.User{}, &models.Role{}, &models.Permission{}, &models.Server{}, &models.ServerRoleStackPermission{}, &models.SeedTracker{}, &session.UserSession{}, &totp.TOTPSecret{}, &totp.UsedCode{}, &auth.PasswordResetToken{}, &auth.EmailVerificationToken{}, &auth.RememberMeToken{}, &revocation.RevokedToken{}, &refreshtoken.RefreshToken{}),
		brx.WithSessionsNoGlobalMiddleware(),
		brx.WithInertiaNoGlobalMiddleware(),
		brx.WithAuth(),
		brx.WithTOTP(),
		brx.WithJWT(),
		brx.WithJWTRevocation(),
		brx.WithFxOptions(
			websocket.Module,
			jwt.Options,
			fx.Provide(func() *BerthConfig {
				return &cfg
			}),
			fx.Provide(func(cfg *BerthConfig) *utils.Crypto {
				return utils.NewCrypto(cfg.Custom.EncryptionSecret)
			}),
			fx.Provide(agent.NewService),
			fx.Provide(rbac.NewService),
			fx.Provide(rbac.NewMiddleware),
			fx.Provide(rbac.NewRBACHandler),
			fx.Provide(rbac.NewAPIHandler),
			fx.Provide(setup.NewService),
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
			fx.Invoke(StartWebSocketHub),
			fx.Invoke(websocket.StartWebSocketServiceManager),
			fx.Invoke(func(db *gorm.DB) {
				if err := seeds.SeedRBACData(db); err != nil {
					panic(err)
				}
			}),
		),
	).Run()
}

func StartWebSocketHub(hub *websocket.Hub) {
	go hub.Run()
}
