package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"berth/internal/pkg/config"
	"berth/internal/platform/inertia"
	"berth/internal/platform/logging"
	"berth/internal/platform/ssl"

	"go.uber.org/fx"
	"go.uber.org/zap"
	"gorm.io/gorm"
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

func NewApp(opts *AppOptions) *App {
	if opts == nil {
		opts = &AppOptions{}
	}

	cfg := resolveConfig(opts)
	certFile, keyFile := resolveCertificates(opts)
	logger := mustNewLogger(cfg)
	db := mustOpenDatabase(cfg, logger)
	inertiaSvc := inertia.New(&cfg.Inertia, SessionStoreResolver, logger)
	e := NewEcho(cfg, logger)

	fxOpts := assembleFxOptions(cfg, logger, db, inertiaSvc, e, certFile, keyFile, opts.ExtraFxOptions)

	return &App{
		fx:     fx.New(fxOpts...),
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

func resolveConfig(opts *AppOptions) *config.Config {
	if opts.Config != nil {
		return opts.Config
	}
	if !opts.SkipConfigEnforcement {
		config.EnforceRequiredSettings()
	}
	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}

func resolveCertificates(opts *AppOptions) (string, string) {
	if opts.CertFile != "" && opts.KeyFile != "" {
		return opts.CertFile, opts.KeyFile
	}
	certFile, keyFile, err := ssl.NewCertificateManager().EnsureCertificates()
	if err != nil {
		panic(err)
	}
	return certFile, keyFile
}

func mustNewLogger(cfg *config.Config) *zap.Logger {
	logger, err := logging.NewLogger(cfg)
	if err != nil {
		panic(fmt.Errorf("failed to create logger: %w", err))
	}
	return logger
}

func mustOpenDatabase(cfg *config.Config, logger *zap.Logger) *gorm.DB {
	db, err := OpenDatabase(cfg, logger, DatabaseModels()...)
	if err != nil {
		panic(fmt.Errorf("failed to initialize database: %w", err))
	}
	return db
}
