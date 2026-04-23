package logging

import (
	"berth/internal/pkg/config"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func NewLogger(cfg *config.Config) (*zap.Logger, error) {
	zapConfig := zap.NewProductionConfig()
	zapConfig.Level = zap.NewAtomicLevelAt(parseLevel(cfg.Log.Level))

	switch cfg.Log.Format {
	case "console":
		zapConfig.Encoding = "console"
		zapConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	case "json":
		zapConfig.Encoding = "json"
	}

	out := cfg.Log.Output
	if out == "" {
		out = "stdout"
	}
	zapConfig.OutputPaths = []string{out}
	zapConfig.ErrorOutputPaths = []string{out}

	return zapConfig.Build(zap.AddCaller())
}

func parseLevel(level string) zapcore.Level {
	switch level {
	case "debug":
		return zapcore.DebugLevel
	case "info":
		return zapcore.InfoLevel
	case "warn":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}
