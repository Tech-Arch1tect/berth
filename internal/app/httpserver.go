package app

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"

	"berth/internal/config"
	"berth/internal/logging"

	"github.com/labstack/echo/v4"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

type SSLConfig struct {
	Enabled  bool
	CertFile string
	KeyFile  string
}

func NewEcho(cfg *config.Config, logger *zap.Logger) *echo.Echo {
	logger.Info("initialising HTTP server",
		zap.String("host", cfg.Server.Host),
		zap.String("port", cfg.Server.Port),
		zap.Int("trusted_proxies_count", len(cfg.Server.TrustedProxies)))

	e := echo.New()
	e.HideBanner = false
	configureTrustedProxies(e, cfg.Server.TrustedProxies, logger)
	e.Use(logging.RequestLogger(logger))
	return e
}

func configureTrustedProxies(e *echo.Echo, trustedProxies []string, logger *zap.Logger) {
	if len(trustedProxies) == 0 {
		e.IPExtractor = echo.ExtractIPDirect()
		logger.Info("No trusted proxies configured - using direct IP extraction (secure)")
		return
	}

	var trustOptions []echo.TrustOption
	for _, proxy := range trustedProxies {
		if proxy == "" {
			continue
		}
		var network *net.IPNet
		var err error
		if _, network, err = net.ParseCIDR(proxy); err != nil {
			if ip := net.ParseIP(proxy); ip != nil {
				if ip.To4() != nil {
					_, network, _ = net.ParseCIDR(proxy + "/32")
				} else {
					_, network, _ = net.ParseCIDR(proxy + "/128")
				}
			} else {
				logger.Warn("invalid trusted proxy - skipping", zap.String("proxy", proxy))
				continue
			}
		}
		if network != nil {
			trustOptions = append(trustOptions, echo.TrustIPRange(network))
		}
	}

	if len(trustOptions) == 0 {
		e.IPExtractor = echo.ExtractIPDirect()
		logger.Info("no valid trusted proxies - using direct IP extraction")
		return
	}

	e.IPExtractor = echo.ExtractIPFromXFFHeader(trustOptions...)
	logger.Info("configured trusted proxies", zap.Strings("proxies", trustedProxies))
}

func RegisterHTTPLifecycle(lc fx.Lifecycle, e *echo.Echo, cfg *config.Config, ssl *SSLConfig, logger *zap.Logger) {
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			logRoutes(e, logger)
			if ssl != nil && ssl.Enabled {
				logger.Info("SSL enabled - starting HTTPS server in background",
					zap.String("address", addr),
					zap.String("cert_file", ssl.CertFile),
					zap.String("key_file", ssl.KeyFile))
				go startTLS(e, addr, ssl.CertFile, ssl.KeyFile, logger)
			} else {
				logger.Info("SSL disabled - starting HTTP server in background",
					zap.String("address", addr))
				go start(e, addr, logger)
			}
			return nil
		},
		OnStop: func(ctx context.Context) error {
			logger.Info("server lifecycle - shutting down gracefully")
			if err := e.Shutdown(ctx); err != nil {
				logger.Error("echo server shutdown failed", zap.Error(err))
				return err
			}
			return nil
		},
	})
}

func start(e *echo.Echo, addr string, logger *zap.Logger) {
	if err := e.Start(addr); err != nil {
		if errors.Is(err, http.ErrServerClosed) {
			logger.Info("HTTP server stopped gracefully", zap.String("address", addr))
			return
		}
		logger.Fatal("HTTP server failed to start", zap.Error(err), zap.String("address", addr))
	}
}

func startTLS(e *echo.Echo, addr, certFile, keyFile string, logger *zap.Logger) {
	if err := e.StartTLS(addr, certFile, keyFile); err != nil {
		if errors.Is(err, http.ErrServerClosed) {
			logger.Info("HTTPS server stopped gracefully", zap.String("address", addr))
			return
		}
		logger.Error("HTTPS server failed to start",
			zap.Error(err), zap.String("address", addr),
			zap.String("cert_file", certFile), zap.String("key_file", keyFile))
	}
}

func logRoutes(e *echo.Echo, logger *zap.Logger) {
	routes := e.Routes()
	if len(routes) == 0 {
		logger.Info("no routes registered")
		return
	}
	filtered := make([]*echo.Route, 0, len(routes))
	for _, r := range routes {
		if r.Name == "github.com/labstack/echo/v4.init.func1" {
			continue
		}
		filtered = append(filtered, r)
	}
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].Path == filtered[j].Path {
			return filtered[i].Method < filtered[j].Method
		}
		return filtered[i].Path < filtered[j].Path
	})

	logger.Info("routes registered", zap.Int("route_count", len(filtered)))
	var b strings.Builder
	b.WriteString("\nRegistered Routes:\n")
	for _, r := range filtered {
		b.WriteString(fmt.Sprintf("  %-6s %s -> %s\n", r.Method, r.Path, shortenHandlerName(r.Name)))
	}
	b.WriteString("\n")
	fmt.Print(b.String())
}

func shortenHandlerName(name string) string {
	if slashIndex := strings.Index(name, "/"); slashIndex != -1 {
		name = name[slashIndex+1:]
	}
	if len(name) > 80 {
		parts := []rune(name)
		if len(parts) > 80 {
			return string(parts[:77]) + "..."
		}
	}
	return name
}
