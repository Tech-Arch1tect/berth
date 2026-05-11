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
	"berth/internal/platform/logging"
	"berth/internal/platform/ssl"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type App struct {
	graph  *Graph
	logger *zap.Logger
}

type AppOptions struct {
	Config                *config.Config
	SkipConfigEnforcement bool
	CertFile              string
	KeyFile               string
	Overrides             Overrides
}

func NewApp(opts *AppOptions) *App {
	if opts == nil {
		opts = &AppOptions{}
	}

	cfg := resolveConfig(opts)
	certFile, keyFile := resolveCertificates(opts)
	logger := mustNewLogger(cfg)
	db := mustOpenDatabase(cfg, logger)
	e := NewEcho(cfg, logger)

	sslCfg := &SSLConfig{
		Enabled:  true,
		CertFile: certFile,
		KeyFile:  keyFile,
	}

	graph, err := Build(cfg, logger, db, e, sslCfg, opts.Overrides)
	if err != nil {
		panic(fmt.Errorf("build app graph: %w", err))
	}

	return &App{
		graph:  graph,
		logger: logger,
	}
}

func (a *App) Graph() *Graph { return a.graph }

func (a *App) Start() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	for _, h := range a.graph.Hooks {
		if h.Start == nil {
			continue
		}
		if err := h.Start(ctx); err != nil {
			a.logger.Error("startup hook failed", zap.String("hook", h.Name), zap.Error(err))
			return fmt.Errorf("start %s: %w", h.Name, err)
		}
	}
	return nil
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

	for i := len(a.graph.Hooks) - 1; i >= 0; i-- {
		h := a.graph.Hooks[i]
		if h.Stop == nil {
			continue
		}
		if err := h.Stop(ctx); err != nil {
			a.logger.Error("shutdown hook failed", zap.String("hook", h.Name), zap.Error(err))
		}
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
