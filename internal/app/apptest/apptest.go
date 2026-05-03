package apptest

import (
	"testing"

	"berth/internal/app"
	"berth/internal/domain/auth"
	"berth/internal/pkg/config"
	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"go.uber.org/fx"
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
}

type Option func(*bootSettings)

type bootSettings struct {
	configMods []func(*config.Config)
	fxExtras   []fx.Option
}

func WithConfig(mod func(*config.Config)) Option {
	return func(s *bootSettings) { s.configMods = append(s.configMods, mod) }
}

func WithFxExtras(opts ...fx.Option) Option {
	return func(s *bootSettings) { s.fxExtras = append(s.fxExtras, opts...) }
}

func Boot(t *testing.T, options ...Option) *Booted {
	t.Helper()

	settings := &bootSettings{}
	for _, opt := range options {
		opt(settings)
	}

	cfg := BuildConfig(t, settings.configMods...)
	mailSvc := NewCapturingMailService()

	booted := &Booted{
		Config: cfg,
		Mail:   mailSvc,
	}

	overrides := []fx.Option{
		fx.Decorate(func(auth.MailService) auth.MailService {
			return mailSvc
		}),
		fx.Populate(&booted.Logger, &booted.DB, &booted.Echo, &booted.Inertia),
	}
	overrides = append(overrides, settings.fxExtras...)

	certFile, keyFile := ensureSSLCerts(t)
	a := app.NewApp(&app.AppOptions{
		Config:         cfg,
		CertFile:       certFile,
		KeyFile:        keyFile,
		ExtraFxOptions: overrides,
	})

	require.NoError(t, a.Start(), "failed to start app under test")
	t.Cleanup(a.Stop)

	return booted
}
