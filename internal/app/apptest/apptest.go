package apptest

import (
	"testing"

	"berth/internal/app"
	"berth/internal/pkg/config"
	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Booted struct {
	Config  *config.Config
	Logger  *zap.Logger
	DB      *gorm.DB
	Echo    *echo.Echo
	Inertia *inertia.Service
	Mail    *CapturingMailService
	Graph   *app.Graph
}

type Option func(*bootSettings)

type bootSettings struct {
	configMods       []func(*config.Config)
	beforeRoutes     []func(*app.Graph)
	operationAuditor app.OperationLogAuditor
	securityAuditor  app.SecurityLogAuditor
}

func WithConfig(mod func(*config.Config)) Option {
	return func(s *bootSettings) { s.configMods = append(s.configMods, mod) }
}

func WithBeforeRoutes(hook func(*app.Graph)) Option {
	return func(s *bootSettings) { s.beforeRoutes = append(s.beforeRoutes, hook) }
}

func WithOperationAuditor(a app.OperationLogAuditor) Option {
	return func(s *bootSettings) { s.operationAuditor = a }
}

func WithSecurityAuditor(a app.SecurityLogAuditor) Option {
	return func(s *bootSettings) { s.securityAuditor = a }
}

func Boot(t *testing.T, options ...Option) *Booted {
	t.Helper()

	settings := &bootSettings{}
	for _, opt := range options {
		opt(settings)
	}

	cfg := BuildConfig(t, settings.configMods...)
	mailSvc := NewCapturingMailService()

	beforeRoutes := func(g *app.Graph) {
		for _, hook := range settings.beforeRoutes {
			hook(g)
		}
	}

	certFile, keyFile := ensureSSLCerts(t)
	a := app.NewApp(&app.AppOptions{
		Config:   cfg,
		CertFile: certFile,
		KeyFile:  keyFile,
		Overrides: app.Overrides{
			Mail:             mailSvc,
			OperationAuditor: settings.operationAuditor,
			SecurityAuditor:  settings.securityAuditor,
			BeforeRoutes:     beforeRoutes,
		},
	})

	require.NoError(t, a.Start(), "failed to start app under test")
	t.Cleanup(a.Stop)

	g := a.Graph()
	return &Booted{
		Config:  cfg,
		Logger:  g.Logger,
		DB:      g.DB,
		Echo:    g.Echo,
		Inertia: g.Inertia,
		Mail:    mailSvc,
		Graph:   g,
	}
}
