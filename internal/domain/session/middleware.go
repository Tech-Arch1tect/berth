package session

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type contextKey string

const (
	sessionManagerContextKey contextKey = "session_manager"

	sessionManagerKey = "session_manager"
	sessionServiceKey = "session_service"
)

func Middleware(manager *Manager) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if manager == nil {
				return next(c)
			}

			c.Set(sessionManagerKey, manager)

			if isWebSocketUpgrade(c.Request()) {
				ctx := context.WithValue(c.Request().Context(), sessionManagerContextKey, manager)

				token := ""
				if cookie, err := c.Cookie(manager.SessionManager.Cookie.Name); err == nil {
					token = cookie.Value
				}
				if token != "" {
					if loadedCtx, err := manager.SessionManager.Load(ctx, token); err == nil {
						ctx = loadedCtx
					}
				}

				c.SetRequest(c.Request().WithContext(ctx))
				return next(c)
			}

			var handlerErr error

			rw := &responseWriterWrapper{
				ResponseWriter: c.Response().Writer,
				echo:           c.Response(),
			}

			handler := manager.SessionManager.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

				ctx := context.WithValue(r.Context(), sessionManagerContextKey, manager)
				c.SetRequest(r.WithContext(ctx))
				c.Response().Writer = w
				handlerErr = next(c)
			}))

			handler.ServeHTTP(rw, c.Request())
			return handlerErr
		}
	}
}

func isWebSocketUpgrade(r *http.Request) bool {
	conn := strings.ToLower(r.Header.Get("Connection"))
	return strings.Contains(conn, "upgrade") && strings.ToLower(r.Header.Get("Upgrade")) == "websocket"
}

type responseWriterWrapper struct {
	http.ResponseWriter
	echo *echo.Response
}

func (w *responseWriterWrapper) Header() http.Header {
	return w.ResponseWriter.Header()
}

func (w *responseWriterWrapper) Write(b []byte) (int, error) {
	return w.ResponseWriter.Write(b)
}

func (w *responseWriterWrapper) WriteHeader(statusCode int) {
	if w.echo.Status == 0 {
		w.echo.Status = statusCode
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func GetManager(c echo.Context) *Manager {
	if manager := c.Get(sessionManagerKey); manager != nil {
		return manager.(*Manager)
	}
	return nil
}

func GetManagerFromContext(ctx context.Context) *Manager {
	if manager := ctx.Value(sessionManagerContextKey); manager != nil {
		return manager.(*Manager)
	}
	return nil
}

func TrackingMiddleware(service *Service) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if service != nil {
				c.Set(sessionServiceKey, service)
			}

			err := next(c)

			if service != nil && IsAuthenticated(c) {
				manager := GetManager(c)
				if manager != nil {
					token := manager.Token(c.Request().Context())
					if token != "" {
						userID := convertToUint(GetUserID(c))
						if userID == 0 {
							return err
						}

						ipAddress := c.RealIP()
						userAgent := c.Request().UserAgent()
						expiresAt := time.Now().Add(manager.config.MaxAge)

						if exists, err := service.SessionExists(token); err == nil && !exists {
							_ = service.TrackSession(userID, token, SessionTypeWeb, ipAddress, userAgent, expiresAt)
						}
					}
				}
			}

			return err
		}
	}
}
