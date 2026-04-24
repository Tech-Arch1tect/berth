package session

import (
	"net/http"

	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	sessionSvc *Service
}

func NewHandler(db *gorm.DB, inertiaSvc *inertia.Service, sessionSvc *Service) *Handler {
	return &Handler{
		db:         db,
		inertiaSvc: inertiaSvc,
		sessionSvc: sessionSvc,
	}
}

func (h *Handler) Sessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Session service not available")
	}

	userID := GetUserIDAsUint(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}

	manager := GetManager(c)
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
		deviceInfo := GetDeviceInfo(sess.UserAgent)

		sessionData[i] = map[string]any{
			"id":          sess.ID,
			"current":     sess.Current,
			"type":        sess.Type,
			"ip_address":  sess.IPAddress,
			"location":    GetLocationInfo(sess.IPAddress),
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
