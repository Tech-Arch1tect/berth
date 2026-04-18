package session

import (
	"time"

	"github.com/labstack/echo/v4"
)

const (
	UserIDKey        = "_user_id"
	AuthenticatedKey = "_authenticated"
	TOTPVerifiedKey  = "_totp_verified"
	TOTPEnabledKey   = "_totp_enabled"
)

type TOTPChecker interface {
	IsUserTOTPEnabled(userID uint) bool
}

func Login(c echo.Context, userID any) {
	LoginWithTOTPService(c, userID, nil)
}

func LoginWithTOTPService(c echo.Context, userID any, totpSvc TOTPChecker) {
	manager := GetManager(c)
	if manager == nil {
		return
	}
	ctx := c.Request().Context()
	manager.Put(ctx, UserIDKey, userID)
	manager.Put(ctx, AuthenticatedKey, true)

	manager.Remove(ctx, TOTPVerifiedKey)

	userIDUint := convertToUint(userID)
	if userIDUint > 0 && totpSvc != nil {
		enabled := totpSvc.IsUserTOTPEnabled(userIDUint)
		manager.Put(ctx, TOTPEnabledKey, enabled)
	} else {
		manager.Put(ctx, TOTPEnabledKey, false)
	}

	if service := getSessionService(c); service != nil {
		token := manager.Token(ctx)
		if token != "" {
			if userIDUint > 0 {
				ipAddress := c.RealIP()
				userAgent := c.Request().UserAgent()
				expiresAt := time.Now().Add(manager.config.MaxAge)

				_ = service.TrackSession(userIDUint, token, SessionTypeWeb, ipAddress, userAgent, expiresAt)
			}
		}
	}
}

func Logout(c echo.Context) {
	manager := GetManager(c)
	if manager == nil {
		return
	}
	ctx := c.Request().Context()

	token := manager.Token(ctx)

	manager.Remove(ctx, UserIDKey)
	manager.Remove(ctx, AuthenticatedKey)
	manager.Remove(ctx, TOTPVerifiedKey)
	manager.Remove(ctx, TOTPEnabledKey)
	manager.Destroy(ctx)

	if service := getSessionService(c); service != nil && token != "" {
		_ = service.RemoveSessionByToken(token)
	}
}

func GetUserID(c echo.Context) any {
	manager := GetManager(c)
	if manager == nil {
		return nil
	}
	ctx := c.Request().Context()
	return manager.Get(ctx, UserIDKey)
}

func GetUserIDAsUint(c echo.Context) uint {
	userID := GetUserID(c)
	if userID == nil {
		return 0
	}

	switch v := userID.(type) {
	case uint:
		return v
	case int:
		return uint(v)
	case int64:
		return uint(v)
	case uint64:
		return uint(v)
	case float64:
		return uint(v)
	default:
		return 0
	}
}

func getSessionService(c echo.Context) *Service {
	if service, ok := c.Get("session_service").(*Service); ok {
		return service
	}
	return nil
}

func IsAuthenticated(c echo.Context) bool {
	manager := GetManager(c)
	if manager == nil {
		return false
	}
	ctx := c.Request().Context()
	return manager.GetBool(ctx, AuthenticatedKey)
}

func RequireAuthWeb(loginURL string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !IsAuthenticated(c) {
				return c.Redirect(302, loginURL)
			}
			return next(c)
		}
	}
}

func Set(c echo.Context, key string, value any) {
	manager := GetManager(c)
	if manager == nil {
		return
	}
	ctx := c.Request().Context()
	manager.Put(ctx, key, value)
}

func Get(c echo.Context, key string) any {
	manager := GetManager(c)
	if manager == nil {
		return nil
	}
	ctx := c.Request().Context()
	return manager.Get(ctx, key)
}

func SetTOTPVerified(c echo.Context, verified bool) {
	manager := GetManager(c)
	if manager == nil {
		return
	}
	ctx := c.Request().Context()
	manager.Put(ctx, TOTPVerifiedKey, verified)
}

func SetTOTPEnabled(c echo.Context, enabled bool) {
	manager := GetManager(c)
	if manager == nil {
		return
	}
	ctx := c.Request().Context()
	manager.Put(ctx, TOTPEnabledKey, enabled)
}

func IsTOTPVerified(c echo.Context) bool {
	manager := GetManager(c)
	if manager == nil {
		return false
	}
	ctx := c.Request().Context()
	return manager.GetBool(ctx, TOTPVerifiedKey)
}

func IsTOTPEnabled(c echo.Context) bool {
	manager := GetManager(c)
	if manager == nil {
		return false
	}
	ctx := c.Request().Context()
	return manager.GetBool(ctx, TOTPEnabledKey)
}

func RequireTOTPWeb(totpURL string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !IsAuthenticated(c) {
				return c.Redirect(302, "/auth/login")
			}

			if IsTOTPEnabled(c) && !IsTOTPVerified(c) {
				return c.Redirect(302, totpURL)
			}

			return next(c)
		}
	}
}

func convertToUint(userID any) uint {
	switch v := userID.(type) {
	case uint:
		return v
	case int:
		return uint(v)
	case int64:
		return uint(v)
	case uint64:
		return uint(v)
	case float64:
		return uint(v)
	default:
		return 0
	}
}
