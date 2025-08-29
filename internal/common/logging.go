package common

import (
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

func LogFields(c echo.Context, additionalFields ...zap.Field) []zap.Field {
	fields := []zap.Field{
		zap.String("remote_ip", c.RealIP()),
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("method", c.Request().Method),
		zap.String("path", c.Request().URL.Path),
	}

	if userID, err := GetCurrentUserID(c); err == nil {
		fields = append(fields, zap.Uint("user_id", userID))
	}

	return append(fields, additionalFields...)
}

func LogError(logger *zap.Logger, c echo.Context, msg string, err error, additionalFields ...zap.Field) {
	fields := LogFields(c, additionalFields...)
	if err != nil {
		fields = append(fields, zap.Error(err))
	}
	logger.Error(msg, fields...)
}

func LogInfo(logger *zap.Logger, c echo.Context, msg string, additionalFields ...zap.Field) {
	fields := LogFields(c, additionalFields...)
	logger.Info(msg, fields...)
}

func LogWarn(logger *zap.Logger, c echo.Context, msg string, additionalFields ...zap.Field) {
	fields := LogFields(c, additionalFields...)
	logger.Warn(msg, fields...)
}
