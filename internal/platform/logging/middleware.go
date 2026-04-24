package logging

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"
)

func RequestLogger(logger *zap.Logger) echo.MiddlewareFunc {
	return middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:    true,
		LogURI:       true,
		LogError:     true,
		LogMethod:    true,
		LogLatency:   true,
		LogRemoteIP:  true,
		LogUserAgent: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			fields := []zap.Field{
				zap.String("method", v.Method),
				zap.String("uri", v.URI),
				zap.Int("status", v.Status),
				zap.Duration("latency", v.Latency),
				zap.String("remote_ip", v.RemoteIP),
				zap.String("user_agent", v.UserAgent),
			}
			if v.Error != nil {
				fields = append(fields, zap.Error(v.Error))
			}

			switch {
			case v.Status >= 500:
				logger.Error("server error", fields...)
			case v.Status >= 400:
				logger.Warn("client error", fields...)
			case v.Status >= 300:
				logger.Info("redirection", fields...)
			default:
				logger.Info("request", fields...)
			}
			return nil
		},
	})
}
