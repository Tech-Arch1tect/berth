package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"berth/internal/pkg/apidocs"
	"berth/internal/pkg/config"
	"berth/internal/platform/ssl"
	"berth/routes"

	"berth/internal/auth"
	"berth/internal/logging"
	"berth/internal/platform/inertia"
	"berth/internal/platform/mail"

	"github.com/labstack/echo/v4"

	"berth/internal/imageupdates"
	"berth/internal/vulnscan"

	"go.uber.org/fx"
	"go.uber.org/zap"
)

type App struct {
	fx     *fx.App
	logger *zap.Logger
}

type AppOptions struct {
	Config                *config.Config
	SkipConfigEnforcement bool
	CertFile              string
	KeyFile               string
	ExtraFxOptions        []fx.Option
}

func LoadConfig() (*config.Config, error) {
	var cfg config.Config
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

func NewApp(opts *AppOptions) *App {
	if opts == nil {
		opts = &AppOptions{}
	}

	var cfg *config.Config
	var err error
	if opts.Config != nil {
		cfg = opts.Config
	} else {
		if !opts.SkipConfigEnforcement {
			config.EnforceRequiredSettings()
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

	logger, err := logging.NewLogger(cfg)
	if err != nil {
		panic(fmt.Errorf("failed to create logger: %w", err))
	}

	db, err := OpenDatabase(cfg, logger, DatabaseModels()...)
	if err != nil {
		panic(fmt.Errorf("failed to initialize database: %w", err))
	}

	inertiaSvc := inertia.New(&cfg.Inertia, SessionStoreResolver, logger)

	e := NewEcho(cfg, logger)

	fxOptions := []fx.Option{
		fx.NopLogger,

		fx.Supply(cfg),
		fx.Supply(logger),
		fx.Supply(db),
		fx.Supply(inertiaSvc),
		fx.Supply(e),
		fx.Supply(&SSLConfig{
			Enabled:  true,
			CertFile: certFile,
			KeyFile:  keyFile,
		}),

		fx.Provide(mail.NewClient),
		fx.Provide(func(c *mail.Client) auth.MailService { return c }),

		CoreFxOptions(),

		fx.Provide(apidocs.NewOpenAPI),
		fx.Invoke(routes.RegisterAPIDocs),
		fx.Invoke(func(e *echo.Echo, apiDoc *apidocs.OpenAPI, cfg *config.Config) {
			routes.RegisterOpenAPIEndpoints(e, apiDoc, cfg)
		}),
		fx.Invoke(RegisterHTTPLifecycle),

		fx.Invoke(func(svc *imageupdates.Service) {}),
		fx.Invoke(vulnscan.StartPoller),
	}

	if len(opts.ExtraFxOptions) > 0 {
		fxOptions = append(fxOptions, opts.ExtraFxOptions...)
	}

	return &App{
		fx:     fx.New(fxOptions...),
		logger: logger,
	}
}

func (a *App) Start() error {
	return a.fx.Start(context.Background())
}

func (a *App) Run() {
	if err := a.Start(); err != nil {
		log.Fatalf("Failed to start application: %v", err)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	a.logger.Info("Received shutdown signal, stopping gracefully...")
	a.Stop()
}

func (a *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := a.fx.Stop(ctx); err != nil {
		a.logger.Error("Failed to stop application gracefully")
	}
}

func Run() {
	NewApp(nil).Run()
}
