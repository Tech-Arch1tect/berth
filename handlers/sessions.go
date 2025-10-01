package handlers

import (
	"net/http"

	"berth/internal/security"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type SessionHandler struct {
	db         *gorm.DB
	inertiaSvc *inertia.Service
	sessionSvc session.SessionService
	auditSvc   *security.AuditService
}

func NewSessionHandler(db *gorm.DB, inertiaSvc *inertia.Service, sessionSvc session.SessionService, auditSvc *security.AuditService) *SessionHandler {
	return &SessionHandler{
		db:         db,
		inertiaSvc: inertiaSvc,
		sessionSvc: sessionSvc,
		auditSvc:   auditSvc,
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

func (h *SessionHandler) RevokeSession(c echo.Context) error {
	if h.sessionSvc == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Session service not available")
	}

	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}

	var req struct {
		SessionID uint `json:"session_id" form:"session_id"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	if req.SessionID == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "Session ID is required")
	}

	err := h.sessionSvc.RevokeSession(userID, req.SessionID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to revoke session")
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err == nil {
		_ = h.auditSvc.LogAuthEvent(
			security.EventAuthSessionRevoked,
			&userID,
			user.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			true,
			"",
			map[string]any{
				"session_id": req.SessionID,
			},
		)
	}

	session.AddFlashSuccess(c, "Session revoked successfully")

	if c.Request().Header.Get("Accept") == "application/json" {
		return c.JSON(http.StatusOK, map[string]string{
			"message": "Session revoked successfully",
		})
	}

	return c.Redirect(http.StatusSeeOther, "/sessions")
}

func (h *SessionHandler) RevokeAllOtherSessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Session service not available")
	}

	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}

	manager := session.GetManager(c)
	if manager == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Session manager not available")
	}

	currentToken := manager.Token(c.Request().Context())
	if currentToken == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "Current session token not found")
	}

	err := h.sessionSvc.RevokeAllOtherSessions(userID, currentToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to revoke sessions")
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err == nil {
		_ = h.auditSvc.LogAuthEvent(
			security.EventAuthSessionsRevokedAll,
			&userID,
			user.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			true,
			"",
			nil,
		)
	}

	session.AddFlashSuccess(c, "All other sessions revoked successfully")

	if c.Request().Header.Get("Accept") == "application/json" {
		return c.JSON(http.StatusOK, map[string]string{
			"message": "All other sessions revoked successfully",
		})
	}

	return c.Redirect(http.StatusSeeOther, "/sessions")
}
