package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type SessionHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	sessionSvc session.SessionService
}

func NewSessionHandler(db *gorm.DB, inertiaSvc *inertia.Service, sessionSvc session.SessionService) *SessionHandler {
	return &SessionHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		sessionSvc: sessionSvc,
	}
}

func (h *SessionHandler) Sessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Session service not available")
	}

	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}

	manager := session.GetManager(c)
	currentToken := ""
	if manager != nil {
		currentToken = manager.Token(c.Request().Context())
	}

	sessions, err := h.sessionSvc.GetUserSessions(userID, currentToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve sessions")
	}

	sessionData := make([]map[string]any, len(sessions))
	for i, sess := range sessions {
		deviceInfo := session.GetDeviceInfo(sess.UserAgent)

		sessionData[i] = map[string]any{
			"id":          sess.ID,
			"current":     sess.Current,
			"type":        sess.Type,
			"ip_address":  sess.IPAddress,
			"location":    session.GetLocationInfo(sess.IPAddress),
			"browser":     deviceInfo["browser"],
			"os":          deviceInfo["os"],
			"device_type": deviceInfo["device_type"],
			"device":      deviceInfo["device"],
			"mobile":      deviceInfo["mobile"],
			"tablet":      deviceInfo["tablet"],
			"desktop":     deviceInfo["desktop"],
			"bot":         deviceInfo["bot"],
			"created_at":  sess.CreatedAt,
			"last_used":   sess.LastUsed,
			"expires_at":  sess.ExpiresAt,
		}
	}

	return h.inertiaSvc.Render(c, "Sessions/Index", map[string]any{
		"sessions": sessionData,
	})
}
